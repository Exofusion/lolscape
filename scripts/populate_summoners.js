var cache_layer = require('./cache_layer');
var riot_api = require('./riot_api');
var async = require('async');

var region = 'na';
var region_id = 1;

var summoner_batch = [];
var summoner_count = 0;

function getRandomSummonerId() {
  return Math.floor(Math.random() * 76510041);
}

step();

function step() {
  if (summoner_batch.length < 40) {
    summoner_batch.push(getRandomSummonerId());
    summoner_count++;
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
  riot_api.getSummonerDataById(region, summoner_id, function(summoner_data) {
    if (summoner_data != null) {
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
    }
  });
}