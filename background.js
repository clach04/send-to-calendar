// Create the context menu
var cmSendToCalendar = chrome.contextMenus.create({ "title": "WIP - Send To Calendar", "contexts": ["all"], "onclick": SendToCalendarOuter });

// Do all the things
function SendToCalendarOuter(data, tab) {
    // Preserve newlines in the selection
    chrome.tabs.executeScript( {
        code: "window.getSelection().toString();"
    }, function(selection) {
        if (selection) {
            // selection[0] contains text including line breaks
            SendToCalendar(selection[0], tab);
        } else if (data.selectionText) {
            // https://bugs.chromium.org/p/chromium/issues/detail?id=116429
            // data.selectionText contains text without line breaks
            SendToCalendar(data.selectionText, tab);
        } else {
            SendToCalendar("", tab);
        }
    });
}


// compiled regex used by find_date()

// TODO look at using \b for word boundary in more places.

// Format 1 - (American) English spelled out using words date; Saturday, December 28th, 2019 -- super dumb, ignore day name, also ignore st, rd, th
const re_month_names = '((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?))';	// Month 1
const re_match_any = '.*?';	// Non-greedy match on filler
const re_two_digit_day = '((?:(?:[0-2]?\\d{1})|(?:[3][01]{1})))(?![\\d])';	// Day 1
const re_four_digit_year = '((?:(?:[1]{1}\\d{1}\\d{1}\\d{1})|(?:[2]{1}\\d{3})))?(?![\\d])';	// Year 1
const monthname_to_int = {"jan": 0, "feb": 1, "mar": 2, "apr": 3, "may": 4, "jun": 5, "jul": 6, "aug": 7, "sep": 8, "oct": 9, "nov": 10, "dec": 11};  // month names to Javascript date month offsets
const r_monthname_day_year = new RegExp(re_month_names + re_match_any + re_two_digit_day + re_match_any + re_four_digit_year, ["i"]);

// Format 2 - American format short date; 12/28/19 and 12/28/2019
var re_slash_dash_dot = '(?:[/\\-\\.])';	// one of; /-.
const re_four_or_two_digit_year = '((?:\\d{2})(?:\\d{2})?)(?![\\d])';	// Year 4 or 2 digits
const r_us_digits_month_day_year = new RegExp(re_two_digit_day + re_slash_dash_dot + re_two_digit_day + re_slash_dash_dot + re_four_or_two_digit_year, ["i"]);  // FIXME remove case insensitive, not needed

// Time format, hopefully handle 24 hour format and am/pm
// TODO unittests; 6pm 6 pm 6:00 (consider treating as 6pm if missing leading 0?) 6:00pm  -- 06:00 -- treat as 6am
const re_time = '((?:(?:[0-1][0-9])|(?:[2][0-3])|(?:[0-9])):(?:[0-5][0-9])(?::[0-5][0-9])?)';  // Hour:Minute:Sec
const re_time_ampm = '(?:\\s?(:am|AM|pm|PM)?)';  // optional am/pm
const r_time = new RegExp(re_time + re_time_ampm, ["i"]);

function find_date(in_str, default_year, default_month, default_day)
{
    chrome.extension.getBackgroundPage().console.log('find_date() entry');

    var result_date=null;
    chrome.extension.getBackgroundPage().console.log(in_str);

    // check out https://txt2re.com/ for quick aid in crafting regex, recommend hand tuning afterwards

    // Check if the selected text contains some dates
    // For now, only use the first one found
    var year = default_year;
    var month = default_month;
    var day = default_day;

    var hours = -1;
    var mins = 0;
    var m = r_time.exec(in_str);
    if (m != null)
    {
      chrome.extension.getBackgroundPage().console.log('find_date() found time.....');
      chrome.extension.getBackgroundPage().console.log('find_date() found time: ' + m[0]);
      var time_str = m[1];
      var ampm_str = m[2];
      var time = time_str.split(':', 2)  // only look at and hours:mins -- ignore secs, etc.
      var hours_str = time[0];
      var mins_str = time[1];

      hours = parseInt(hours_str);
      mins = parseInt(mins_str);
      // if hours_str[0] == '0' then its probably 24 hours -- for now do nothing
      // if hours_str[0] != '0', and hours <=8 consider treating as a pm (even) if no specifier
      if (ampm_str)
      {
          if (ampm_str.toLowerCase() == 'pm')
          {
              hours = hours + 12;  // convert to 24 hour format
          }
          // else assume am
      }
      //else  // assume 24 hour format
      // Now wipe out the captured time text from the selection and search/match again for end time
    }
    else
    {
              chrome.extension.getBackgroundPage().console.log('find_date() did NOT found time.....');
    }

    m = r_monthname_day_year.exec(in_str);
    if (m === null)
    {
        m = r_us_digits_month_day_year.exec(in_str);
    }
    if (m != null)
    {
        chrome.extension.getBackgroundPage().console.log('find_date() found date: ' + m[0]);
      // US Date Format 1 or 2 - month, day, year
      var month_str = m[1];
      var day_str = m[2];
      var year_str = m[3];

      month = monthname_to_int[month_str.slice(0, 3).toLowerCase()];
      if (month === undefined)
      {
        // assume only integers present,  parseInt() will happily consume without errors things like '8Oct' :-(
        month = parseInt(month_str) - 1;
      }
      day = parseInt(day_str);
      if (year_str){
         year = parseInt(year_str);
          if (year < 100)
          {
              year += 2000;
          }
      }

      if (hours == -1)
      {
          hours = 0;
          mins = 0;
      }
      // Now wipe out the captured time text from the selection and search/match again for end time
    }
    if (hours != -1)
    {
        // definitely found something, either a time and date was defaulted or found date and time was defaulted
        result_date = new Date(year, month, day, hours, mins);
    }
    return result_date;
}

function find_dates(in_str)
{
    chrome.extension.getBackgroundPage().console.log('find_dates() entry');
    var now = new Date();
    var end_date=null;
    var modified_in_str=in_str;

    // almost a copy of find_date()
    var result_date=null;
    //chrome.extension.getBackgroundPage().console.log(in_str);

    // check out https://txt2re.com/ for quick aid in crafting regex, recommend hand tuning afterwards

    // Check if the selected text contains some dates
    // For now, only use the first one found
    var year = now.getFullYear(); // Default
    // TODO not sure about this as Node will create negative dates or perform day/month earlier math
    var month = -1;  // for now -1 means not set (but not null)
    var day = -1;

    var hours = -1;  // for now -1 means not set (but not null)
    var mins = 0;
    var m = r_time.exec(in_str);
    if (m != null)
    {
      chrome.extension.getBackgroundPage().console.log('find_dates() found time: ' + m[0]);
      var time_str = m[1];
      var ampm_str = m[2];
      var time = time_str.split(':', 2)  // only look at and hours:mins -- ignore secs, etc.
      var hours_str = time[0];
      var mins_str = time[1];

      hours = parseInt(hours_str);
      mins = parseInt(mins_str);
      // if hours_str[0] == '0' then its probably 24 hours -- for now do nothing
      // if hours_str[0] != '0', and hours <=8 consider treating as a pm (even) if no specifier
      if (ampm_str)
      {
          if (ampm_str.toLowerCase() == 'pm')
          {
              hours = hours + 12;  // convert to 24 hour format
          }
          // else assume am
      }
      //else  // assume 24 hour format
      // Now wipe out the captured time text from the selection and search/match again for end time
      modified_in_str = modified_in_str.replace(m[0], '')  // remove time, and hope we can locate the date
    }

    m = r_monthname_day_year.exec(in_str);
    if (m === null)
    {
        m = r_us_digits_month_day_year.exec(in_str);
    }
    if (m != null)
    {
        chrome.extension.getBackgroundPage().console.log('find_dates() found date: ' + m[0]);
      // US Date Format 1 or 2 - month, day, year
      var month_str = m[1];
      var day_str = m[2];
      var year_str = m[3];
      month = monthname_to_int[month_str.slice(0, 3).toLowerCase()];
      if (month === undefined)
      {
        // assume only integers present,  parseInt() will happily consume without errors things like '8Oct' :-(
        month = parseInt(month_str) - 1;
      }
      day= parseInt(day_str);
      if (year_str){
         year = parseInt(year_str);
          if (year < 100)
          {
              year += 2000;
          }
      }

      if (hours == -1)
      {
          hours = 9;  // TODO pick a better default start time? Without an explict default, there is an implicit start time of midnight
          mins = 0;
      }
      // Now wipe out the captured time text from the selection and search/match again for end time
      chrome.extension.getBackgroundPage().console.log([year, month, day, hours, mins]);
      result_date = new Date(year, month, day, hours, mins);
      modified_in_str = modified_in_str.replace(m[0], '')  // remove date
    }
    else
    {
        if (hours != -1)
        {
            // found a time without date
            result_date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, mins);
        }
    }

    if (result_date)
    {
        end_date = find_date(modified_in_str, result_date.getFullYear(), result_date.getMonth(), result_date.getDate());
    }
    if (result_date && end_date === null)
    {
        const one_hour = 1 * 60 * 60 * 1000; // Number of milliseconds per hour
        end_date = new Date(result_date);
        end_date.setTime(end_date.getTime() + one_hour);
    }
    chrome.extension.getBackgroundPage().console.log(result_date);
    chrome.extension.getBackgroundPage().console.log(end_date);

    return [result_date, end_date];
}

function SendToCalendar(selection, tab) {

    // Max URI length is 2000 chars, but let's keep under 1600
    // to also allow a buffer for google login/redirect urls etc.
    // (This limit is not a hard limit in the code,
    // but we don't surpass it by more than a few tens of chars.)
    var maxLength = 1600;
    maxLength = 4000;  // test, looks like Chrome and FF spport alt least 32K

    // Start building the URL
	var url = "http://www.google.com/calendar/event?action=TEMPLATE";
    
    // Page title to event title
    // url += "&text=" + TrimURITo(tab.title, maxLength);

    // Check if the selected text contains a US formatted address
    // and it its first 100 chars to URI if so
    var address = selection.match(/(\d+\s+[':.,\s\w]*,\s*[A-Za-z]+\s*\d{5}(-\d{4})?)/m);
    if (address) {
        // Location goes to location
        url += "&location=" + TrimURITo(address[0], maxLength - url.length);
    }

    // Check if the selected text contains some dates
    // For now, only use the first one found
    var dates = find_dates(selection);
    var start_date = dates[0];
    var end_date = dates[1];
    if (start_date) {
        var date_str = start_date.toISOString();
        date_str = date_str.replace('-', '').replace('-', '').replace('-', '');  // this is so stupid, regex not working for me :-(
        date_str = date_str.replace(':', '').replace(':', '').replace('.', '');  // this is so stupid, regex not working for me :-(
        date_str = date_str.replace('000Z', 'Z');

        url +=  "&dates=" + date_str;  // start date/time

        date_str = end_date.toISOString();
        date_str = date_str.replace('-', '').replace('-', '').replace('-', '');  // this is so stupid, regex not working for me :-(
        date_str = date_str.replace(':', '').replace(':', '').replace('.', '');  // this is so stupid, regex not working for me :-(
        date_str = date_str.replace('000Z', 'Z');
        url += "%2F" + date_str;  // end date/time
    }
    //console.log(JSON.stringify({ x: 5, y: 6 }));  // does not do anything in Chrome
    // url += JSON.stringify({ x: 5, y: 6 });  // debug printf logging


    var title = TrimURITo(tab.title + " - " + selection, Math.min(maxLength - url.length, 200));
    url += "&text=" + title;  // Event title

    // (trim to half of the available length cause its twice in the URI)
    url += "&details=" + encodeURIComponent(tab.url) + TrimURITo("\n\n" + selection, (maxLength - url.length)/2 - url.length);  // Event description/details

    // Debug - possibbly new feature/option copy URL to clipboard
    //navigator.clipboard.writeText(url);


    // Open the created url in a new tab
	chrome.tabs.create({ "url": url}, function (tab) {});
}

// Trim text so that its URI encoding fits into the length limit
// and return its URI encoding
function TrimURITo(text, length) {
    var textURI = encodeURI(text);
    if (textURI.length > length) {
        // Different charsets can lead to a different blow-up after passing the
        // text through encodeURI, so let's estimate the blow up first,
        // and then trim the text so that it fits the limit...
        var blowUp = textURI.length/text.length;
        var newLength = Math.floor(length / blowUp) - 3;  // -3 for "..."
        do {
            // trim the text & show that it was trimmed...
            text = text.substring(0, newLength) + "...";
            textURI = encodeURI(text);
            newLength = Math.floor(0.9 * newLength);
        } while (textURI.length > length);
    }

    return textURI;
}

// TODO: configuration to include tab.url in description?
