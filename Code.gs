// Current problems with this program:
// 1. It doesn't account for multiple seats very well (see TODOs in voting.gs)
function onOpen(e) {
  SpreadsheetApp.getUi().createMenu("Single Transferrable Vote Tally").addItem("Tally Votes", "tallyVotes").addToUi();
}