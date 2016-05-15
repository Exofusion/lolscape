var cache_layer = require('../scripts/cache_layer');
var riot_api = require('../scripts/riot_api');
var async = require('async');

var region_id = process.argv[2];

var summoner_batch = [];
var summoner_count = 0;
var current_id = 1;

var max_summoner_id = 76510041;

function getRandomSummonerId() {
  return Math.floor(Math.random() * max_summoner_id);
}

step();
function step() {
  if (summoner_batch.length < 40) {
    summoner_batch.push(current_id);
    summoner_count++;
    current_id++;
    step();
  } else {
    getSummonerDataById(region_id, summoner_batch.join(), function(summoner_data) {
      console.log('[ '+summoner_count+' ]');
      step();
    });
    
    summoner_batch = [];
  }
}

function getSummonerDataById(region_id, summoner_id, callback) {
  riot_api.getSummonerDataById(cache_layer.region_mapping[region_id], summoner_id, function(summoner_data) {
    if (summoner_data == null)
      return callback(null);
    
    var json_summoner_data = JSON.parse(summoner_data);
    var keys = Object.keys(json_summoner_data);
    
    async.forEachSeries(keys, function(key, next) {
      if (json_summoner_data[key] != undefined) {
        cache_layer.updateSummonerDataCache(region_id, json_summoner_data[key],
          function(data) {
            cache_layer.getMasteryEntriesById(region_id, key, function(mastery_data) {
              next();
            });
          });
      } else {
        console.log('summoner response had no id');
      }
    }, function(err) {
      if (err)
      {
        console.log(summoner_data);
      }
      
      callback(summoner_data);
    });
  });
}