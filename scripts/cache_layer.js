// cache_layer
//
// This class allows indirect access to the API.  It's designed in such a way
// that the response to every call to "riot_api" is cached in the local database,
// to aid in leaderboard lookup.

var async = require('async');
var riot_api = require('./riot_api');

// Show debug messages
var DEBUG = false;

// Expose functions for access to cache methods
exports.cleanName = cleanName;
exports.getSummonerDataByName = getSummonerDataByName;
exports.getSummonerDataById = getSummonerDataById;
exports.getMasteryEntriesByName = getMasteryEntriesByName;
exports.getMasteryEntriesById = getMasteryEntriesById;
exports.getChampRanking = getChampRanking;
exports.getTotalSummoners = getTotalSummoners;
exports.getOverallHighscores = getOverallHighscores;
exports.getSummonerDataFromDB = getSummonerDataFromDB;
exports.updateChampMasteryCache = updateChampMasteryCache;
exports.updateSummonerDataCache = updateSummonerDataCache;

var region_mapping = [ '',
                       'na',
                       'br',
                       'eune',
                       'euw',
                       'jp',
                       'kr',
                       'lan',
                       'las',
                       'oce',
                       'tr',
                       'ru' ];
exports.region_mapping = region_mapping;

// This function simply normalizes a summoner name for lookup, since letter-case and spacing is ignored
// on Riot's end.
// Ex: "Null Pointer" => "nullpointer"
function cleanName(name) {
  return name.toLowerCase().replace(/\s/g, '');
}

// Fetch and cache the summoner JSON data using a summoner name
function getSummonerDataByName(client, region_id, summoner_name, callback) {
  if(DEBUG) console.log('getSummonerDataByName()');
  getSummonerDataByNameFromAPI(client, region_id, summoner_name, function(summoner_data) { callback(summoner_data); });
}

// Fetch and cache the summoner JSON data using a summoner ID
function getSummonerDataById(client, region_id, summoner_id, callback) {
  if(DEBUG) console.log('getSummonerDataById()');
  getSummonerDataByIdFromAPI(client, region_id, summoner_id, function(summoner_data) { callback(summoner_data); });
}

// Fetch and cache summoner entries for a summoner name
function getMasteryEntriesByName(client, region_id, summoner_name, callback) {
  if(DEBUG) console.log('getSummonerEntriesByName()');
  if (summoner_name.length > 0) {
    getSummonerId(client, region_id, summoner_name, function(summoner_id) {
      getMasteryEntriesById(client, region_id, summoner_id, callback);
    });
  } else {
    callback(null);
  }
}

// Fetch and cache summoner entries for a summoner ID
function getMasteryEntriesById(client, region_id, summoner_id, callback) {
  if(DEBUG) console.log('getMasteryEntriesById()');
  if (summoner_id != null) {
    getChampMasteryDataFromAPI(client, region_id, summoner_id, function(champ_mastery_data) { callback(champ_mastery_data); });
  } else {
    callback(null);
  }
}

// Retrieves the global ranking on a champion given a champion_points input
function getChampRanking(client, region_id, champion_points, champion_id, callback) {
  if(DEBUG) console.log(`getChampRanking(${champion_points}, ${champion_id})`);
  // Old Query just in case I need it back.  Unfortunately the window function ROW_NUMBER() wouldn't choose my index.
  /*
      SELECT r.summoner_id, r.region_id, r.champion_id, r.champion_rank \
                    FROM (SELECT summoner_id, region_id, champion_id, ROW_NUMBER() OVER (ORDER BY champion_points DESC NULLS LAST) AS champion_rank \
                          FROM summoner_champ_mastery WHERE champion_id=$3) r \
                    WHERE summoner_id=$1 AND region_id=$2
  */
  
  var query_string = 'SELECT COUNT(1)+1 AS champion_rank \
                      FROM summoner_champ_mastery \
                      WHERE champion_points > $1 AND champion_id = $2';
  var query_params = [champion_points, champion_id];
  
  if (region_id > 0) {
    query_string += ' AND region_id = $3'
    query_params.push(region_id);
  }
  
  query_string += ';';
  
  client.query(query_string, query_params, function(err, result) {
    if(err) {
      return console.error('error running query', err);
    }
    
    if (result.rowCount > 0) {
      callback(parseInt(result.rows[0].champion_rank));
    } else {
      callback(null);
    }
  });
}

// Commonly called function to get the total number of summoners with champ mastery data in the database
// Note: Since all summoners with at least one champion mastery entry will have an overall total saved as champion_id 0,
//       passing 0 for champion_id is an easy way to get the total number of summoners with mastery data.
function getTotalSummoners(client, region_id, champion_id, callback) {
  if(DEBUG) console.log('getTotalSummoners()');
  var query_string = 'SELECT COUNT(1) AS total_summoners FROM summoner_champ_mastery WHERE champion_id = $1';
  var query_params = [champion_id];
  
  if (region_id > 0) {
    query_string += ' AND region_id = $2'
    query_params.push(region_id);
  }
  
  query_string += ';';
  
  client.query(query_string, query_params, function(err, result) {
    if(err) {
      return console.error('error running query', err);
    }
    
    if (result.rowCount > 0) {
      callback(parseInt(result.rows[0].total_summoners));
    } else {
      callback(null);
    }
  });
}

// Get the top 100 summoners for a specific champion, or champion 0 for all champions
// order_by should contain the column name for sorting
function getOverallHighscores(client, region_id, champion_id, order_by, callback) {
  if(DEBUG) console.log('getOverallHighscores');
  var query_string = `SELECT scm.region_id,
                             scm.summoner_id,
                             scm.champion_points AS overall_points,
                             scm.champion_level AS overall_level,
                             sd.name,
                             sd.profile_icon_id,
                             ROW_NUMBER() OVER () AS rank
                      FROM summoner_champ_mastery scm
                      LEFT JOIN summoner_data sd
                                ON scm.summoner_id = sd.id
                                AND scm.region_id = sd.region_id
                      WHERE champion_id=$1`;
  var query_params = [champion_id];
  
  if (region_id > 0) {
    query_string += ' AND region_id = $2'
    query_params.push(region_id);
  }
  
  query_string += 'ORDER BY '+order_by+' DESC NULLS LAST LIMIT 100;';
  
  client.query(query_string, query_params, function(err, result) {
    if(err) {
      return console.error('error running query', err);
    }
    
    callback(result.rows);
  });
}

// Call to manually skip fetching from the API for summoner data, and only use what's available in the local database
function getSummonerDataFromDB(client, region_id, summoner_id, callback) {
  if(DEBUG) console.log('getSummonerDataFromDB()');
  client.query('SELECT * FROM summoner_data WHERE region_id=$1 AND id=$2;', [region_id, summoner_id], function(err, result) {
    if(err) {
      return console.error('error running query', err);
    }
    
    if (result.rowCount > 0) {
      callback(result.rows[0]);
    } else {
      callback(null);
    }
  });
}

// Call to manually fetch summoner data from the API, and update the local database with the response afterwards
function getChampMasteryDataFromAPI(client, region_id, summoner_id, callback) {
  if(DEBUG) console.log('getChampMasteryDataFromAPI()');
  riot_api.getAllChampionMasteryEntries(region_mapping[region_id], summoner_id, function(champ_mastery_data) {
    if (champ_mastery_data) {
      updateChampMasteryCache(client, region_id, JSON.parse(champ_mastery_data), callback);
    } else {
      callback(null);
    }
  });
}

function getSummonerDataByNameFromAPI(client, region_id, summoner_name, callback) {
  if(DEBUG) console.log('getSummonerDataFromAPI()');
  riot_api.getSummonerDataByName(region_mapping[region_id], summoner_name, function(summoner_data) {
    if (summoner_data == null) {
      callback(null);
    } else {      
      var json_summoner_data = JSON.parse(summoner_data);
      var key = Object.keys(json_summoner_data)[0];
      
      if (json_summoner_data[key] != undefined) {
        updateSummonerDataCache(client, region_id, json_summoner_data[key], callback);
      } else {
        console.log('summoner response had no id');
      }
    }
  });
}

function getSummonerDataByIdFromAPI(client, region_id, summoner_id, callback) {
  if(DEBUG) console.log('getSummonerDataByIdFromAPI()');
  riot_api.getSummonerDataById(region_mapping[region_id], summoner_id, function(summoner_data) {
    if (summoner_data == null) {
      callback(null);
    } else {      
      var json_summoner_data = JSON.parse(summoner_data);
      var key = Object.keys(json_summoner_data)[0];
      
      if (json_summoner_data[key] != undefined) {
        updateSummonerDataCache(client, region_id, json_summoner_data[key], callback);
      } else {
        console.log('summoner response had no id');
      }
    }
  });
}

// Uses the JSON object array for all champion mastery entries for a summoner to update their entries in the local database
function updateChampMasteryCache(client, region_id, champ_mastery_data, callback) {
  if(DEBUG) console.log('updateChampMasteryCache()');
  if ((champ_mastery_data && champ_mastery_data.length) > 0) {
    var overall_points = 0;
    var overall_level = 0;
    var summonerId = null;
    async.forEach(champ_mastery_data, function(current, next){
      
      if (summonerId === null) {
        summonerId = current.playerId;
      }
      
      client.query('INSERT INTO summoner_champ_mastery(summoner_id, region_id, champion_id, champion_points, champion_points_until_next_level, champion_points_since_last_level, champion_level, chest_granted, last_play_time, highest_grade, last_updated) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) ON CONFLICT ON CONSTRAINT summoner_champ_mastery_pkey DO \
                    UPDATE SET champion_points=$4, champion_points_until_next_level=$5, champion_points_since_last_level=$6, champion_level=$7, chest_granted=$8, last_play_time=$9, highest_grade=$10, last_updated=NOW() WHERE summoner_champ_mastery.summoner_id=$1 AND summoner_champ_mastery.region_id=$2 AND summoner_champ_mastery.champion_id=$3;',
                   [current.playerId, region_id, current.championId, current.championPoints, current.championPointsUntilNextLevel, current.championPointsSinceLastLevel, current.championLevel, current.chestGranted, current.lastPlayTime, current.highestGrade],
                   function(err, result) {
        if(err) {
          return console.error('error running query', err);
        }
        
        overall_points += current.championPoints;
        overall_level += current.championLevel;
        next();
      });
    }, function(err) {
      if (err) {
        console.log(err);
      }
      
      // Overall champion mastery points and levels are saved under champion_id 0 to allow for speedy lookup later
      client.query('INSERT INTO summoner_champ_mastery(summoner_id, region_id, champion_id, champion_points, champion_level, last_updated) VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT ON CONSTRAINT summoner_champ_mastery_pkey DO \
                    UPDATE SET champion_points=$4, champion_level=$5, last_updated=NOW() WHERE summoner_champ_mastery.summoner_id=$1 AND summoner_champ_mastery.region_id=$2 AND summoner_champ_mastery.champion_id=$3;',
                   [summonerId, region_id, 0, overall_points, overall_level],
                   function(err, result) {
        if(err) {
          return console.error('error running query', err);
        }

        callback(champ_mastery_data);
      });
    });
  } else {
    callback(null);
  }
}

function updateSummonerDataCache(client, region_id, summoner_data, callback) {
  if(DEBUG) console.log('updateSummonerDataCache()');
  if (summoner_data == undefined || summoner_data.name == undefined) {
    callback(null);
  } else {
    // Clean our summoner name => Remove whitespace and make all lowercase
    var name = summoner_data.name;
    var name_cleaned = cleanName(name);
    
    client.query('INSERT INTO summoner_data(id, region_id, name, name_cleaned, revision_date, summoner_level, profile_icon_id, last_updated) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) ON CONFLICT ON CONSTRAINT summoner_data_pkey DO \
                  UPDATE SET name=$3, name_cleaned=$4, revision_date=$5, summoner_level=$6, profile_icon_id=$7, last_updated=NOW() WHERE summoner_data.id=$1 AND summoner_data.region_id=$2;',
                 [summoner_data.id, region_id, name, name_cleaned, summoner_data.revisionDate, summoner_data.summonerLevel, summoner_data.profileIconId],
                 function(err, result) {
      if(err) {
        return console.error('error running query', err);
      }
      
      callback(summoner_data);
    });
  }
}

function transformDatabaseChampMastery(champ_mastery_result) {
  if(DEBUG) console.log('transformDatabaseChampMastery()');
  var champ_mastery_object = [];
  for (row in champ_mastery_result) {    
    var current = champ_mastery_result[row];
    var champ_mastery_entry = {};
    
    champ_mastery_entry.championId = current.champion_id;
    champ_mastery_entry.championLevel = current.champion_level;
    champ_mastery_entry.championPoints = current.champion_points;
    champ_mastery_entry.playerId = current.summoner_id;
    
    champ_mastery_object.push(champ_mastery_entry);
  }
  return champ_mastery_object.length > 0 ? champ_mastery_object : null;
}