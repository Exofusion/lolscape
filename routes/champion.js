var express = require('express');
var router = express.Router();
var cache_layer = require('../scripts/cache_layer');
var overall_utils = require('../scripts/overall_utils');

var champ_mapping = require('../resources/champ_mapping.json');

router.get('/', function(req, res, next) {
  var champion_id = req.query.champion_id;
  return res.redirect('/champion/'+champion_id);
});

router.get('/:champion_id', function(req, res, next) {
  var champion_id = req.params.champion_id;
  
  if (!champion_id || champion_id <= 0) {
    return res.redirect('/');
  }
  
  cache_layer.getTotalSummoners(champion_id, function(total_summoners) {
    cache_layer.getOverallHighscores(champion_id, 'champion_points', function(overall_highscores) {
      overall_utils.parseOverall(overall_highscores, function(parsed_overall) {
        res.render('champion', { overall_data: parsed_overall,
                                 champion_data: champ_mapping[champion_id], 
                                 total_summoners: total_summoners });
      });
    });
  });
});

module.exports = router;
