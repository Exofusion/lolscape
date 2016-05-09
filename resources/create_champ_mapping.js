var champions = require('./champion.json').data;
var fs = require('fs');

var champMapping = [];

for (champ in champions) {
  var current = champions[champ];
  champMapping[current.key] = { id: current.id,
                                name: current.name };
}

fs.writeFile("./champ_mapping.json", JSON.stringify(champMapping), function (err) {
  if (err) {
    return console.log(err);
  }
  
  console.log("saved");
});