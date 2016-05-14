var express = require('express');
var router = express.Router();
var cache_layer = require('../scripts/cache_layer');
var overall_utils = require('../scripts/overall_utils');

router.get('/:page_name', function(req, res, next) {
  var page_name = req.params.page_name;
  var region_id = req.query.overall_region;
  return res.redirect('/overall/'+region_id+'/'+page_name);
});

router.get('/:region_id/:page_name', function(req, res, next) {
  var region_id = req.params.region_id;
  var order_by;
  var page_name;
  
  if (req.params.page_name === 'experience') {
    order_by = 'overall_points';
    page_name = 'Experience';
  } else if (req.params.page_name === 'level') {
    order_by = 'overall_level';
    page_name = 'Level';
  }
  
  if (!order_by) {
    return res.redirect('/');
  }
  
  cache_layer.getTotalSummoners(region_id, 0, function(total_summoners) {
    cache_layer.getOverallHighscores(region_id, 0, order_by, function(overall_highscores) {
      overall_utils.parseOverall(overall_highscores, function(parsed_overall) {
        res.render('overall', { overall_data: parsed_overall,
                                page_name: page_name,
                                total_summoners: total_summoners,
                                region_mapping: cache_layer.region_mapping,
                                overall_region: region_id });
      });
    });
  });
});

module.exports = router;
