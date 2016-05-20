var express = require('express');
var router = express.Router();
var pg = require('pg');
var connection_string = require('../scripts/db_connection.js').connection_string;
var compare_utils = require('../scripts/compare_utils');
var cache_layer = require('../scripts/cache_layer');

var champ_mapping = require('../resources/champ_mapping.json');

router.get('/', function(req, res,next) {
  var summoner1 = cache_layer.cleanName(req.query.summoner1);
  var summoner2 = cache_layer.cleanName(req.query.summoner2);
  var summoner1_region = req.query.summoner1_region;
  var summoner2_region = req.query.summoner2_region;
  
  if ((summoner1 && summoner1_region > 0) || (summoner2 && summoner2_region > 0)) {
    pg.connect(connection_string, function(err, client, done) {
      cache_layer.getSummonerDataByName(client, summoner1_region, summoner1, function(summoner1_data) {
        cache_layer.getSummonerDataByName(client, summoner2_region, summoner2, function(summoner2_data) {
          done();
          if (summoner1_data || summoner2_data) {
            return res.redirect('/compare/'+summoner1_region+'/'+(summoner1_data && summoner1_data.id)+'/'+summoner2_region+'/'+(summoner2_data && summoner2_data.id));
          } else {
            // Neither summoner found
            return res.redirect('/');
          }
        });
      });
    });
  } else {
    return res.redirect('/');
  }
});

router.get('/:summoner1_region/:summoner1_id/:summoner2_region/:summoner2_id', function(req, res, next) {
  var summoner1_id = req.params.summoner1_id;
  var summoner2_id = req.params.summoner2_id;
  
  var summoner1_region = req.params.summoner1_region;
  var summoner2_region = req.params.summoner2_region;
  
  if ((!summoner1_id || summoner1_region <= 0) && (!summoner2_id || summoner2_region <= 0)) {
    return res.redirect('./');
  }
  
  // Lookup by Summoner ID instead
  pg.connect(connection_string, function(err, client, done) {
    compare_utils.compare(client, summoner1_region, summoner1_id, summoner2_region, summoner2_id, function (comparison_data) {
      if (!comparison_data) { comparison_data = {} };
      cache_layer.getTotalSummoners(client, 0, 0, function(total_summoners) {
        done();
        comparison_data.champ_mapping = champ_mapping;
        comparison_data.total_summoners = total_summoners;
        res.render('compare', comparison_data);
      });
    });
  });
});

module.exports = router;
