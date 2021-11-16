// CUSTOMIZABLE VOTING STUFF
// Since I'm too lazy to make a config menu.
// How many seats are going to be won today?
var seatsToWin = 1;

// How many choices do voters get?
var numRanks = 5;

// If we have a loser, do all the other losers that are tied with it also lose?
var tiedLosersLoseTogether = false;

// SO ENDS THE CONFIGURATION

function collectVotes () {
  var votesSheet = SpreadsheetApp.getActive().getSheetByName("Form Responses 1");  
  var votes = [];
  var candidates = [];

  if (votesSheet === null){
    SpreadsheetApp.getUi().alert("You need a spreadsheet called \"Form Responses 1\" containing your votes for this to work. Column layout should be: Timestamp	Email Address	Name	UCSC email	First choice	Second choice	Third choice	Fourth choice	Fifth choice	Sixth choice	Seventh choice X choice");
  } else {
    var range = votesSheet.getDataRange();
    var votesData = range.getValues();
    
    for (var row = 1; row < votesData.length; row++){
      // Do we have stuff here?
      var voter = votesData[row];
      if (voter[0] != ""){

        var vote = {};

        for (var choice = 0; choice < numRanks; choice++){
          vote["choice" + choice] = voter[4 + choice];
          if (candidates.indexOf(vote["choice" + choice]) === -1){
            candidates.push(vote["choice" + choice]);
          }
        }

        votes.push(vote);
      }
    }
  }

  return {votes: votes, candidates: candidates};
}


class STVVoteCounter {
  constructor(threshold, votes, candidates){
    this.winners = [];
    this.losers = [];
    this.seatsWon = 0;
    this.threshold = threshold;
    this.votes = votes;
    this.candidates = candidates;
  }

  createTallySheet(){
    this.tallySheet = SpreadsheetApp.getActive().getSheetByName("Tally");
    if(this.tallySheet === null){
      this.tallySheet = SpreadsheetApp.getActive().insertSheet("Tally");
    }

    this.tallySheet.getRange(1, 1, 1, this.candidates.length).setValues([this.candidates]);
    
    return this.tallySheet;
  }

  getRoundVote () {

    var voteSum = {};

    for (var voteI in this.votes){
      var vote = this.votes[voteI];
      var actualVote = "";
      for (var i = 0; i < numRanks; i++) {
        // Did our voter vote for a winner? Stop tallying their vote immediately.
        // TODO: This is something to double check. We might want to do proportional voting surpluses.
        // We don't have to worry about this now, since we only have one winner.
        if (this.winners.indexOf(vote["choice" + i]) !== -1) {
          break;
        }

        if (this.losers.indexOf(vote["choice" + i]) === -1){
          actualVote = vote["choice" + i];
          break;
        }
      }

      if (actualVote != ""){
        if (voteSum[actualVote]){
          voteSum[actualVote] += 1;
        } else {
          voteSum[actualVote] = 1;
        }
      }
    }

    return voteSum;
  }

  getMostPopular(voteSum){
    // TODO: This doesn't account for ties/when both games have enough votes to pass the threshold.
    // Fix this in the future. It's not a problem now, but it will be if we go back to the two games model.
    var mostPopular = {name: "", numVotes: 0};
    for (var candidate in voteSum){
      if (voteSum[candidate] > mostPopular.numVotes){
        mostPopular = {name: candidate, numVotes: voteSum[candidate]};
      }
    }
    return mostPopular;
  }

  getLeastPopular(voteSum){
    var leastPopular = {name: "", numVotes: this.threshold};
    for (var candidate in voteSum){
      if (voteSum[candidate] < leastPopular.numVotes){
        leastPopular = {name: candidate, numVotes: voteSum[candidate]};
      }
    }

    return leastPopular;
  }

  getTied(voteSum, candidate){
    var tiedWith = [candidate];
    for (var c in voteSum){
      if(voteSum[c] === candidate.numVotes && c !== candidate.name){
        tiedWith.push({name: c, numVotes: voteSum[c]});
      }
    }
    return tiedWith;
  }

  debugPrintVoteSum(voteSum, index){
    var toPrint = [];
    for (var vote in voteSum){
      toPrint[this.candidates.indexOf(vote)] = voteSum[vote].toString();
    }
    for (var loser in this.losers){
      // Only print if this person is counted as a loser (and they don't have any votes in the voteSum, meaning they didn't lose this round)
      if (toPrint[this.candidates.indexOf(this.losers[loser])] === undefined){
        toPrint[this.candidates.indexOf(this.losers[loser])] = "LOST";
      }
    }

    for (var winner in this.winners) {
      // Same for winners.
      if (toPrint[this.candidates.indexOf(this.winners[winner])] === undefined){
        toPrint[this.candidates.indexOf(this.winners[winner])] = "WINNER";
      }
    }

    this.tallySheet.getRange(index + 1, 1, 1, this.candidates.length).setValues([toPrint]);
  }

  iterateRound(roundNum) {
    var voteSum = this.getRoundVote();
    
    var potentialWinner = this.getMostPopular(voteSum);

    // If we have enough votes, or if there's only one possible winner left.
    if (potentialWinner.numVotes >= this.threshold || Object.keys(voteSum).length === 1){
      this.winners.push(potentialWinner.name);
      this.seatsWon += 1;

      this.tallySheet.getRange(roundNum + 2, this.candidates.length + 1).setValue(potentialWinner.name + " wins round " + (roundNum) + " with " + potentialWinner.numVotes + " votes.");
    } else if (Object.keys(voteSum).length === 0){
      this.tallySheet.getRange(roundNum + 2, this.candidates.length + 1).setValue("Something went wrong here, and no winner was found. There was probably a tie.");
      // Break out of the loop:
      this.seatsWon = seatsToWin;
    } else {
      var loser = this.getLeastPopular(voteSum);
      if (tiedLosersLoseTogether){
        var tiedLosers = this.getTied(voteSum, loser);
        var names = [];
        for (var loss in tiedLosers){
          names.push(tiedLosers[loss].name);
        }
        this.losers = this.losers.concat(names);
        this.tallySheet.getRange(roundNum + 2, this.candidates.length + 1).setValue(names.toString() + " lose round " + (roundNum) + " with " + loser.numVotes + " votes each.");
      } else {
        this.losers.push(loser.name);
        this.tallySheet.getRange(roundNum + 2, this.candidates.length + 1).setValue(loser.name + " loses round " + (roundNum) + " with " + potentialWinner.numVotes + " votes.");
      }

      
    }

    this.debugPrintVoteSum(voteSum, roundNum + 1);

  }
}

function tallyVotes(){
  SpreadsheetApp.getUi().alert("Warning: the tally process assumes you've eliminated any votes that aren't eligible. It also assumes you'll check the votes yourself in case a tie occurs.");

  var votesObj = collectVotes();
  var votes = votesObj.votes;

  // Now we calculate the votes based on the number of eligible voters:
  var threshold = Math.floor((votes.length)/2 + 1);

  var voteCounter = new STVVoteCounter(threshold, votes, votesObj.candidates);
  voteCounter.createTallySheet();

  var roundNum = 0;
  while (voteCounter.seatsWon < seatsToWin){
    voteCounter.iterateRound(roundNum);
    roundNum++;
  }
}

