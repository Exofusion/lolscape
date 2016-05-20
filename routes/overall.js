var express = require('express');
var router = express.Router();
var pg = require('pg');
var connection_string = require('../scripts/db_connection.js').connection_string;
var cache_layer = require('../scripts/cache_layer');

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
    order_by = 'champion_points';
    page_name = 'Experience';
  } else if (req.params.page_name === 'level') {
    order_by = 'champion_level';
    page_name = 'Level';
  }
  
  if (!order_by) {
    return res.redirect('/');
  }

  pg.connect(connection_string, function(err, client, done) {
    cache_layer.getTotalSummoners(client, region_id, 0, function(total_summoners) {
      cache_layer.getOverallHighscores(client, region_id, 0, order_by, function(overall_highscores) {
        done();
        res.render('overall', { overall_data: overall_highscores,
                                page_name: page_name,
                                total_summoners: total_summoners,
                                region_mapping: cache_layer.region_mapping,
                                overall_region: region_id });
      });
    });
  });
});

module.exports = router;
