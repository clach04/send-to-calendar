Send To Calendar
================

Send To Calendar by Boris Masis

WIP fork at https://github.com/clach04/send-to-calendar

Chrome extension to send events to Google Calendar automagically from any webpage.

   * Original extension page https://chrome.google.com/webstore/detail/send-to-calendar/iefhhfhadhcgefikmjdpclgpmmlaodfc/details
   * More details http://borism.net/2012/12/26/open-sourced-send-to-calendar-chrome-extension/


## Dev notes

In Chrome:

  * open More tools, then Extensions
  * then toggle Developer mode.
  * "Load unpack", select checkout directory

See http://blog.glavin.org/BurntChrome/docs/ for screenshots.

Use `chrome.extension.getBackgroundPage().console.log()` and then click on "Inspect views background page" to see console.

  * https://developer.chrome.com/extensions/extension
  * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/extension/getBackgroundPage
  * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/getBackgroundPage

### Porting

  * https://extensionworkshop.com/documentation/develop/porting-a-google-chrome-extension/
  * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities

