var express = require('express');
var router = express.Router();
var compare_utils = require('../scripts/compare_utils');
var cache_layer = require('../scripts/cache_layer');

var champ_mapping = require('../resources/champ_mapping.json');

function renderComparison(comparison_data, res) {
  if (!comparison_data) { comparison_data = {} };
  
  cache_layer.getTotalSummoners(0, function(total_summoners) {
    comparison_data.champ_mapping = champ_mapping;
    comparison_data.total_summoners = total_summoners;
    res.render('compare', comparison_data);
  });
}

router.get('/', function(req, res,next) {
  var summoner1 = cache_layer.cleanName(req.query.summoner1);
  var summoner2 = cache_layer.cleanName(req.query.summoner2);
  var summoner1_region = 1;
  var summoner2_region = 1;
  
  if (summoner1 || summoner2) {
    cache_layer.getSummonerDataByName(summoner1_region, summoner1, function(summoner1_data) {
      cache_layer.getSummonerDataByName(summoner2_region, summoner2, function(summoner2_data) {
        if (summoner1_data || summoner2_data) {
          return res.redirect('/compare/'+(summoner1_data && summoner1_data.id)+'/'+(summoner2_data && summoner2_data.id));
        } else {
          // Neither summoner found
          return res.redirect('/');
        }
      });
    });
  } else {
    return res.redirect('/');
  }
});

router.get('/:summoner1_id/:summoner2_id', function(req, res, next) {
  var summoner1_id = req.params.summoner1_id;
  var summoner2_id = req.params.summoner2_id;
  
  var summoner1_region = 1;
  var summoner2_region = 1;
  
  if (!summoner1_id && !summoner2_id) {
    return res.redirect('./');
  }
  
  // Lookup by Summoner ID instead
  compare_utils.compare(summoner1_region, summoner1_id, summoner2_region, summoner2_id, function (comparison_data) {
    renderComparison(comparison_data, res);
  });
});

router.get('/', function(req, res, next) {
  renderComparison(null, res);
});

module.exports = router;
