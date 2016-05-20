var express = require('express');
var router = express.Router();
var pg = require('pg');
var connection_string = require('../scripts/db_connection.js').connection_string;
var cache_layer = require('../scripts/cache_layer');

var champ_mapping = require('../resources/champ_mapping.json');

router.get('/', function(req, res, next) {
  var champion_id = req.query.champion_id;
  var region_id = req.query.champion_region;
  return res.redirect('/champion/'+region_id+'/'+champion_id);
});

router.get('/:region_id/:champion_id', function(req, res, next) {
  var champion_id = req.params.champion_id;
  var region_id = req.params.region_id;
  
  if (!champion_id || champion_id <= 0) {
    return res.redirect('/');
  }
  
  pg.connect(connection_string, function(err, client, done) {
    cache_layer.getTotalSummoners(client, region_id, champion_id, function(total_summoners) {
      cache_layer.getOverallHighscores(client, region_id, champion_id, 'champion_points', function(overall_highscores) {
        done();
        res.render('champion', { overall_data: overall_highscores,
                                 champion_data: champ_mapping[champion_id], 
                                 total_summoners: total_summoners,
                                 region_mapping: cache_layer.region_mapping,
                                 champion_region: region_id });
      });
    });
  });
});

module.exports = router;
