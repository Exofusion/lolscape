var async = require('async');
var cache_layer = require('../scripts/cache_layer');

exports.prepare = prepare;
exports.merge = merge;
exports.compare = compare;
exports.parseAndSort = parseAndSort;
exports.personalOrderByXP = personalOrderByXP;

function compare(summoner1_region, summoner1_id, summoner2_region, summoner2_id, callback) {
  cache_layer.getSummonerDataById(summoner1_region, summoner1_id, function(summoner1_data) {
    cache_layer.getSummonerDataById(summoner2_region, summoner2_id, function(summoner2_data) {
      cache_layer.getMasteryEntriesById(summoner1_region, summoner1_data && summoner1_data.id, function(summoner1_mastery_data) {
        cache_layer.getMasteryEntriesById(summoner2_region, summoner2_data && summoner2_data.id, function(summoner2_mastery_data) {
          prepare(summoner1_region, summoner1_mastery_data, summoner2_region, summoner2_mastery_data, function(summoner1_parsed, summoner2_parsed) {
            var champ_mastery_data = comparisonOrderByXP(merge(summoner1_parsed, summoner2_parsed));
            callback({ summoner1_region: summoner1_region,
                       summoner1_data: summoner1_data,
                       summoner2_region: summoner2_region,
                       summoner2_data: summoner2_data,
                       champ_mastery_data: champ_mastery_data,
                       region_mapping: cache_layer.region_mapping });
          });
        });
      });
    });
  });
}

function personalOrderByXP(personal_mastery_data, callback) {
  if (personal_mastery_data && personal_mastery_data.length > 0) {
    var sorted_data = [];
    sorted_data.push(personal_mastery_data[0]);
    sorted_data = sorted_data.concat(personal_mastery_data.slice(1).sort(function(obj1,obj2) {
      return obj2.championPoints - obj1.championPoints;
    }));
    return sorted_data;
  } else {
    return personal_mastery_data;
  }
}

function comparisonOrderByXP(comparison_mastery_data, callback) {
  if (comparison_mastery_data && comparison_mastery_data.length > 0) {
    var sorted_data = [];
    sorted_data.push(comparison_mastery_data[0]);
    sorted_data = sorted_data.concat(comparison_mastery_data.slice(1).sort(function(obj1,obj2) {
      return obj2.s1_championPoints - obj1.s1_championPoints;
    }));
    return sorted_data;
  } else {
    return comparison_mastery_data;
  }
}

function parseAndSort(region_id, json, callback) {
  if (!region_id || !json) {
    return callback(null);
  }
  
  var parsed_data = [];
  
  var overallRank;
  var overallLevel = 0;
  var overallPoints = 0;
  var summonerId = null;
  
  async.forEach(json, function(current, next) {
    cache_layer.getChampRanking(0, current.championPoints, current.championId, function(champ_rank) {
      if (summonerId === null) {
        summonerId = current.playerId;
      }
    
      parsed_data.push({ championId: current.championId,
                         championRank: champ_rank,
                         championLevel: current.championLevel,
                         championPoints: current.championPoints });
      
      overallLevel += current.championLevel;
      overallPoints += current.championPoints;
      next();
    });
  }, function(err) {
    if (err) {
      console.log(err);
    }
    
    parsed_data = parsed_data.sort(function(obj1, obj2) {
      return obj1.championId - obj2.championId;
    });
    
    cache_layer.getChampRanking(0, overallPoints, 0, function(overall_rank) {
      parsed_data.splice(0, 0, { championId: 0,
                                 championRank: overall_rank,
                                 championLevel: overallLevel,
                                 championPoints: overallPoints });

      callback(parsed_data);
    });
  });
}

// Input champion mastery entries must be sorted by champion_id.
// The knowledge of this sorting is utilized by two indexes that step through
// each champion until all champions have been merged into a single record
// with both summoner1 and summoner2's champion mastery data.  This process
// can be thought of as a type of zipper merge.
function merge(summoner1_parsed, summoner2_parsed) {
  var mergedResult = [];
  
  var s1_idx = 0;
  var s2_idx = 0;
  
  while((summoner1_parsed && summoner1_parsed[s1_idx] !== undefined) ||
        (summoner2_parsed && summoner2_parsed[s2_idx] !== undefined)) {
    var s1_cursor = (summoner1_parsed && summoner1_parsed[s1_idx]) || {};
    var s2_cursor = (summoner2_parsed && summoner2_parsed[s2_idx]) || {};
    
    var s1_championId = (s1_cursor && s1_cursor.championId) || 999;
    var s2_championId = (s2_cursor && s2_cursor.championId) || 999;
    
    var championId = null;
    var s1_championRank = null;
    var s1_championLevel = null;
    var s1_championPoints = null;
    var s2_championRank = null;
    var s2_championLevel = null;
    var s2_championPoints = null;
    
    // Add and advance both
    if (s1_championId == s2_championId) {
      championId = s1_cursor.championId;
      s1_championRank = s1_cursor.championRank;
      s1_championLevel = s1_cursor.championLevel;
      s1_championPoints = s1_cursor.championPoints;
      s2_championRank = s2_cursor.championRank;
      s2_championLevel = s2_cursor.championLevel;
      s2_championPoints = s2_cursor.championPoints;
      
      s1_idx++;
      s2_idx++;
    } else if (s1_championId < s2_championId) {
      championId = s1_cursor.championId;
      s1_championRank = s1_cursor.championRank;
      s1_championLevel = s1_cursor.championLevel;
      s1_championPoints = s1_cursor.championPoints;
      
      s1_idx++;
    } else {
      championId = s2_cursor.championId;
      s2_championRank = s2_cursor.championRank;
      s2_championLevel = s2_cursor.championLevel;
      s2_championPoints = s2_cursor.championPoints;
      
      s2_idx++;
    }

    mergedResult.push({ championId: championId,
                        s1_championRank: s1_championRank,
                        s1_championLevel: s1_championLevel,
                        s1_championPoints: s1_championPoints,
                        s1_better: (s1_championPoints || null) >= (s2_championPoints || null),
                        s2_championRank: s2_championRank,
                        s2_championLevel: s2_championLevel,
                        s2_championPoints: s2_championPoints });
  }
  
  return mergedResult;
}

// This really only exists to try to deal with callback hell
function prepare(summoner1_region, summoner1_data, summoner2_region, summoner2_data, callback) {
  parseAndSort(summoner1_region, summoner1_data, function(summoner1_parsed) {
    parseAndSort(summoner2_region, summoner2_data, function(summoner2_parsed) {
      callback(summoner1_parsed, summoner2_parsed);
    });
  });
}