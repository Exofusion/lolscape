var express = require('express');
var router = express.Router();
var pg = require('pg');
var connection_string = require('../scripts/db_connection.js').connection_string;
var cache_layer = require('../scripts/cache_layer');
var compare_utils = require('../scripts/compare_utils');

var champ_mapping = require('../resources/champ_mapping.json');

router.get('/', function(req, res, next) {
  var summoner_name = req.query.summoner;
  var summoner_region = req.query.region;
  
  if (summoner_name && summoner_region) {
    pg.connect(connection_string, function(err, client, done) {
      cache_layer.getSummonerDataByName(client, summoner_region, summoner_name, function(summoner_data) {
        done();
        if (summoner_data && summoner_data.id) {
          return res.redirect('/personal/'+summoner_region+'/'+summoner_data.id);
        } else {
          // Summoner not found
          return res.render('error', { message: "The summoner name you entered could not be found.",
                                       error: { status: "404" }});
        }
      });
    });
  } else {
    return res.redirect('/');
  }
});

/* GET home page. */
router.get('/:region_id/:summoner_id', function(req, res, next) {
  var summoner_id = req.params.summoner_id;
  var summoner_region = req.params.region_id;
  
  if (!summoner_id || !(summoner_region > 0)) {
    return res.redirect('/');
  }
  
  pg.connect(connection_string, function(err, client, done) {
    cache_layer.getTotalSummoners(client, 0, 0, function(total_summoners) {
      cache_layer.getSummonerDataById(client, summoner_region, summoner_id, function(summoner_data) {
        cache_layer.getMasteryEntriesById(client, summoner_region, summoner_data && summoner_data.id, function(champ_mastery_data) {
          compare_utils.parseAndSort(client, summoner_region, champ_mastery_data, function(champ_mastery_data) {
            done();
            champ_mastery_data = compare_utils.personalOrderByXP(champ_mastery_data);
            res.render('personal', { champ_mapping: champ_mapping,
                                     total_summoners: total_summoners,
                                     summoner_region: summoner_region,
                                     summoner_data: summoner_data,
                                     champ_mastery_data: champ_mastery_data,
                                     region_mapping: cache_layer.region_mapping });
          });
        });
      });
    });
  });
});

module.exports = router;
