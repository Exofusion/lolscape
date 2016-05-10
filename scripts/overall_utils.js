var async = require('async');
var cache_layer = require('../scripts/cache_layer');

exports.parseOverall = parseOverall;

function parseOverall(overall_highscores, callback) {
  addSummonerData(overall_highscores, function(overall_summoner_data) {
    var parsed_overall = addRankings(overall_summoner_data);
    callback(parsed_overall);
  });
};

// Since the input rows will already be ordered by champion points in descending order,
// simply use their index in the array to add the ranking
function addRankings(overall_highscores) {
  for (var i=0; i<overall_highscores.length; i++) {
    overall_highscores[i].rank = i+1;
  }
  return overall_highscores;
}

function addSummonerData(overall_highscores, callback) {
  var overall_summoner_data = [];
  
  // This could be collapsed into a single SQL query
  async.forEachSeries(overall_highscores, function(summoner, next) {
    cache_layer.getSummonerDataFromDB(summoner.region_id, summoner.summoner_id, function(summoner_data) {
      if (summoner_data) {
        summoner.name = summoner_data.name;
        summoner.profile_icon_id = summoner_data.profile_icon_id;
      }
      overall_summoner_data.push(summoner);
      next();
    });
  }, function(err) {
    if (err) {
      console.error(err);
    }
    
    callback(overall_summoner_data);
  });
}