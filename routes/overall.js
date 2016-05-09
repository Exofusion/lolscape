var express = require('express');
var router = express.Router();
var cache_layer = require('../scripts/cache_layer');
var overall_utils = require('../scripts/overall_utils');

router.get('/:page_name', function(req, res, next) {
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
  
  cache_layer.getTotalSummoners(0, function(total_summoners) {
    cache_layer.getOverallHighscores(0, order_by, function(overall_highscores) {
      overall_utils.parseOverall(overall_highscores, function(parsed_overall) {
        res.render('overall', { overall_data: parsed_overall,
                                page_name: page_name,
                                total_summoners: total_summoners });
      });
    });
  });
});

module.exports = router;
