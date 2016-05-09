var express = require('express');
var router = express.Router();
var cache_layer = require('../scripts/cache_layer');
var compare_utils = require('../scripts/compare_utils');

var champ_mapping = require('../resources/champ_mapping.json');

router.get('/', function(req, res, next) {
  var summoner_name = req.query.summoner;
  var summoner_region = 1;
  
  if (summoner_name) {
    cache_layer.getSummonerDataByName(summoner_region, summoner_name, function(summoner_data) {
      if (summoner_data && summoner_data.id) {
        return res.redirect('/personal/'+summoner_data.id);
      } else {
        // Summoner not found
        return res.redirect('/');
      }
    });
  } else {
    return res.redirect('/');
  }
});

/* GET home page. */
router.get('/:summoner_id', function(req, res, next) {
  var summoner_id = req.params.summoner_id;
  var summoner_region = 1;
  
  if (!summoner_id) {
    return res.redirect('/');
  }
  
  cache_layer.getTotalSummoners(0, function(total_summoners) {
    cache_layer.getSummonerDataById(summoner_region, summoner_id, function(summoner_data) {
      cache_layer.getMasteryEntriesById(summoner_region, summoner_data && summoner_data.id, function(champ_mastery_data) {
        compare_utils.parseAndSort(summoner_region, champ_mastery_data, function(champ_mastery_data) {
          champ_mastery_data = compare_utils.personalOrderByXP(champ_mastery_data);
          res.render('personal', { champ_mapping: champ_mapping,
                                   total_summoners: total_summoners,
                                   summoner_data: summoner_data,
                                   champ_mastery_data: champ_mastery_data });
        });
      });
    });
  });
});

module.exports = router;
