var pg = require('pg');
var async = require('async');
var riot_api = require('./riot_api');
var connectionString = process.env.DATABASE_URL || 'postgres://pguser:root@localhost:5432/rac2016';

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

var regionIdToName = [ '',
                       'na' ];

function cleanName(name) {
  return name.toLowerCase().replace(/\s/g, '');
}

function getSummonerDataByName(region_id, summoner_name, callback) {
  if(DEBUG) console.log('getSummonerDataByName()');
  getSummonerDataByNameFromAPI(region_id, summoner_name, function(summoner_data) { callback(summoner_data); });
}

function getSummonerDataById(region_id, summoner_id, callback) {
  if(DEBUG) console.log('getSummonerDataById()');
  getSummonerDataByIdFromAPI(region_id, summoner_id, function(summoner_data) { callback(summoner_data); });
}

function getMasteryEntriesByName(region_id, summoner_name, callback) {
  if(DEBUG) console.log('getSummonerEntriesByName()');
  if (summoner_name.length > 0) {
    getSummonerId(region_id, summoner_name, function(summoner_id) {
      getMasteryEntriesById(region_id, summoner_id, callback);
    });
  } else {
    callback(null);
  }
}

function getMasteryEntriesById(region_id, summoner_id, callback) {
  if(DEBUG) console.log('getMasteryEntriesById()');
  if (summoner_id != null) {
    getChampMasteryDataFromAPI(region_id, summoner_id, function(champ_mastery_data) { callback(champ_mastery_data); });
  } else {
    callback(null);
  }
}

function getChampRanking(champion_points, champion_id, callback) {
  if(DEBUG) console.log(`getChampRanking(${champion_points}, ${champion_id})`);
  pg.connect(connectionString, function(err, client, done) {
      if(err) {
        return console.error('error fetching client from pool', err);
      }
      
      // Old Query just in case I need it back
      /*
          SELECT r.summoner_id, r.region_id, r.champion_id, r.champion_rank \
                        FROM (SELECT summoner_id, region_id, champion_id, ROW_NUMBER() OVER (ORDER BY champion_points DESC) AS champion_rank \
                              FROM summoner_champ_mastery WHERE champion_id=$3) r \
                        WHERE summoner_id=$1 AND region_id=$2
      */
      
      client.query('SELECT COUNT(1)+1 AS champion_rank \
                    FROM (SELECT 1 \
                          FROM summoner_champ_mastery \
                          WHERE champion_points > $1 AND champion_id = $2) r',
                    [champion_points, champion_id], function(err, result) {
        //call `done()` to release the client back to the pool
        done();

        if(err) {
          return console.error('error running query', err);
        }
        
        if (result.rowCount > 0) {
          callback(parseInt(result.rows[0].champion_rank));
        } else {
          callback(null);
        }
      });
  });
}

function getTotalSummoners(champion_id, callback) {
  if(DEBUG) console.log('getTotalSummoners()');
  pg.connect(connectionString, function(err, client, done) {
      if(err) {
        return console.error('error fetching client from pool', err);
      }
      
      client.query('SELECT COUNT(1) AS total_summoners FROM summoner_champ_mastery WHERE champion_id=$1;', [champion_id], function(err, result) {
        //call `done()` to release the client back to the pool
        done();

        if(err) {
          return console.error('error running query', err);
        }
        
        if (result.rowCount > 0) {
          callback(parseInt(result.rows[0].total_summoners));
        } else {
          callback(null);
        }
      });
  });
}

function getOverallHighscores(champion_id, order_by, callback) {
  if(DEBUG) console.log('getOverallHighscores');
  pg.connect(connectionString, function(err, client, done) {
    if(err) {
      return console.error('error fetching client from pool', err);
    }
    
    client.query('SELECT region_id, summoner_id, champion_points AS overall_points, champion_level AS overall_level FROM summoner_champ_mastery WHERE champion_id=$1 ORDER BY '+order_by+' DESC NULLS LAST LIMIT 100;', [champion_id], function(err, result) {
      //call `done()` to release the client back to the pool
      done();

      if(err) {
        return console.error('error running query', err);
      }
      
      callback(result.rows);
    });
  });
}

function getSummonerDataFromDB(region_id, summoner_id, callback) {
  if(DEBUG) console.log('getSummonerDataFromDB()');
  pg.connect(connectionString, function(err, client, done) {
    if(err) {
      return console.error('error fetching client from pool', err);
    }
    
    client.query('SELECT * FROM summoner_data WHERE region_id=$1 AND id=$2;', [region_id, summoner_id], function(err, result) {
      //call `done()` to release the client back to the pool
      done();

      if(err) {
        return console.error('error running query', err);
      }
      
      if (result.rowCount > 0) {
        callback(result.rows[0]);
      } else {
        callback(null);
      }
    });
  });
}

function getChampMasteryDataFromAPI(region_id, summoner_id, callback) {
  if(DEBUG) console.log('getChampMasteryDataFromAPI()');
  riot_api.getAllChampionMasteryEntries(regionIdToName[region_id], summoner_id, function(champ_mastery_data) {
    if (champ_mastery_data) {
      updateChampMasteryCache(region_id, JSON.parse(champ_mastery_data), callback);
    } else {
      callback(null);
    }
  });
}

function getSummonerDataByNameFromAPI(region_id, summoner_name, callback) {
  if(DEBUG) console.log('getSummonerDataFromAPI()');
  riot_api.getSummonerDataByName(regionIdToName[region_id], summoner_name, function(summoner_data) {
    if (summoner_data == null) {
      callback(null);
    } else {      
      var json_summoner_data = JSON.parse(summoner_data);
      var key = Object.keys(json_summoner_data)[0];
      
      if (json_summoner_data[key] != undefined) {
        updateSummonerDataCache(region_id, json_summoner_data[key], callback);
      } else {
        console.log('summoner response had no id');
      }
    }
  });
}

function getSummonerDataByIdFromAPI(region_id, summoner_id, callback) {
  if(DEBUG) console.log('getSummonerDataByIdFromAPI()');
  riot_api.getSummonerDataById(regionIdToName[region_id], summoner_id, function(summoner_data) {
    if (summoner_data == null) {
      callback(null);
    } else {      
      var json_summoner_data = JSON.parse(summoner_data);
      var key = Object.keys(json_summoner_data)[0];
      
      if (json_summoner_data[key] != undefined) {
        updateSummonerDataCache(region_id, json_summoner_data[key], callback);
      } else {
        console.log('summoner response had no id');
      }
    }
  });
}

function updateChampMasteryCache(region_id, champ_mastery_data, callback) {
  if(DEBUG) console.log('updateChampMasteryCache()');
  if ((champ_mastery_data && champ_mastery_data.length) > 0) {
    pg.connect(connectionString, function(err, client, done) {
      if(err) {
        return console.error('error fetching client from pool', err);
      }
      
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
          //call `done()` to release the client back to the pool

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
        
        client.query('INSERT INTO summoner_champ_mastery(summoner_id, region_id, champion_id, champion_points, champion_level, last_updated) VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT ON CONSTRAINT summoner_champ_mastery_pkey DO \
                      UPDATE SET champion_points=$4, champion_level=$5, last_updated=NOW() WHERE summoner_champ_mastery.summoner_id=$1 AND summoner_champ_mastery.region_id=$2 AND summoner_champ_mastery.champion_id=$3;',
                     [summonerId, region_id, 0, overall_points, overall_level],
                     function(err, result) {
          //call `done()` to release the client back to the pool
          done();

          if(err) {
            return console.error('error running query', err);
          }

          callback(champ_mastery_data);
        });
      });
    });
  } else {
    callback(null);
  }
}

function updateSummonerDataCache(region_id, summoner_data, callback) {
  if(DEBUG) console.log('updateSummonerDataCache()');
  if (summoner_data == undefined || summoner_data.name == undefined) {
    callback(null);
  } else {
    pg.connect(connectionString, function(err, client, done) {
      if(err) {
        return console.error('error fetching client from pool', err);
      }
      
      // Clean our summoner name => Remove whitespace and make all lowercase
      var name = summoner_data.name;
      var name_cleaned = cleanName(name);
      
      client.query('INSERT INTO summoner_data(id, region_id, name, name_cleaned, revision_date, summoner_level, profile_icon_id, last_updated) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) ON CONFLICT ON CONSTRAINT summoner_data_pkey DO \
                    UPDATE SET name=$3, name_cleaned=$4, revision_date=$5, summoner_level=$6, profile_icon_id=$7, last_updated=NOW() WHERE summoner_data.id=$1 AND summoner_data.region_id=$2;',
                   [summoner_data.id, region_id, name, name_cleaned, summoner_data.revisionDate, summoner_data.summonerLevel, summoner_data.profileIconId],
                   function(err, result) {
        //call `done()` to release the client back to the pool
        done();

        if(err) {
          return console.error('error running query', err);
        }
        
        callback(summoner_data);
      });
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