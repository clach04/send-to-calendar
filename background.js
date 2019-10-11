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
            // data.selectionText contains text without line breaks
            SendToCalendar(data.selectionText, tab);
        } else {
            SendToCalendar("", tab);
        }
    });
}


// compiled regex used by find_date()

// Format 1 - Saturday, October 12th, 2019 -- super dumb, ignore day name, also ignore st, rd, th
const re_month_names = '((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?))';	// Month 1
const re_match_any = '.*?';	// Non-greedy match on filler
const re_two_digit_day = '((?:(?:[0-2]?\\d{1})|(?:[3][01]{1})))(?![\\d])';	// Day 1
const re_four_digit_year = '((?:(?:[1]{1}\\d{1}\\d{1}\\d{1})|(?:[2]{1}\\d{3})))(?![\\d])';	// Year 1
const monthname_to_int = {"jan": 0, "feb": 1, "mar": 2, "apr": 3, "may": 4, "jun": 5, "jul": 6, "aug": 7, "sep": 8, "oct": 9, "nov": 10, "dec": 11};  // month names to Javascript date month offsets
const r_monthname_day_year = new RegExp(re_month_names + re_match_any + re_two_digit_day + re_match_any + re_four_digit_year, ["i"]);

const re_time = '((?:(?:[0-1][0-9])|(?:[2][0-3])|(?:[0-9])):(?:[0-5][0-9])(?::[0-5][0-9])?)';  // Hour:Minute:Sec
const re_time_ampm = '(?:\\s?(:am|AM|pm|PM)?)';  // optional am/pm
const r_time = new RegExp(re_time + re_time_ampm, ["i"]);

function find_date(in_str)
{
    var result_date=null;

    // check out https://txt2re.com/ for quick aid in crafting regex, recommend hand tuning afterwards

    // Check if the selected text contains some dates
    // For now, only use the first one found
    var hours = -1;
    var m = r_time.exec(in_str);
    if (m != null)
    {
      var time_str = m[1];
      var ampm_str = m[2];
      var time = time_str.split(':', 2)  // only look at and hours:mins -- ignore secs, etc.
      var hours_str = time[0];
      var mins_str = time[1];
      hours = parseInt(hours_str);
      var mins = parseInt(mins_str);
      // if hours_str[0] == '0' then its probably 24 hours -- for now do nothing
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

    m = r_monthname_day_year.exec(in_str);
    if (m != null)
    {
      var month_str = m[1];
      var day_str = m[2];
      var year_str = m[3];
      var month = monthname_to_int[month_str.slice(0, 3).toLowerCase()];
      var day= parseInt(day_str);
      var year = parseInt(year_str);

      if (hours == -1)
      {
          hours = 0;
          mins = 0;
      }
      // Now wipe out the captured time text from the selection and search/match again for end time
      result_date = new Date(year, month, day, hours, mins);
    }
    return result_date;
}

function SendToCalendar(selection, tab) {

    // Max URI length is 2000 chars, but let's keep under 1600
    // to also allow a buffer for google login/redirect urls etc.
    // (This limit is not a hard limit in the code,
    // but we don't surpass it by more than a few tens of chars.)
    var maxLength = 1600;

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
    var start_date = find_date(selection);
    if (start_date) {
        var one_hour = 1 * 60 * 60 * 1000; // Number of milliseconds per hour
        var end_date = new Date(start_date);
        var date_str = start_date.toISOString();
        date_str = date_str.replace('-', '').replace('-', '').replace('-', '');  // this is so stupid, regex not working for me :-(
        date_str = date_str.replace(':', '').replace(':', '').replace('.', '');  // this is so stupid, regex not working for me :-(
        date_str = date_str.replace('000Z', 'Z');

        url +=  "&dates=" + date_str;  // start date/time

        end_date.setTime(end_date.getTime() + one_hour);
        date_str = end_date.toISOString();
        date_str = date_str.replace('-', '').replace('-', '').replace('-', '');  // this is so stupid, regex not working for me :-(
        date_str = date_str.replace(':', '').replace(':', '').replace('.', '');  // this is so stupid, regex not working for me :-(
        date_str = date_str.replace('000Z', 'Z');
        url += "%2F" + date_str;  // end date/time
    }
    //console.log(JSON.stringify({ x: 5, y: 6 }));  // does not do anything in Chrome
    // url += JSON.stringify({ x: 5, y: 6 });  // debug printf logging


    // URL goes to start of details (event description)
    url += "&details=" + TrimURITo(tab.url + "\n\n", maxLength - url.length);  // Event description/details

    // Selection goes to end of details, and to ctext (google calendar quick add),
    // (trim to half of the available length cause its twice in the URI)
    // ctext is also prepended with tab.title,
    // so that Google Calendar can use it to generate the text,
    // but can also include other info.
    var title = TrimURITo(tab.title + "\n", maxLength - url.length);
    var selection = TrimURITo(selection, (maxLength - url.length)/2 - title.length);
    url += selection + "&text=" + title + selection;  // Event title

	
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
