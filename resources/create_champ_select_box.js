var fs = require('fs');

var champ_mapping = require('./champ_mapping.json');

var champ_list = [];

for (champ_id in champ_mapping) {
  if (champ_mapping[champ_id]) {
    champ_list.push({ id: champ_id,
                      name: champ_mapping[champ_id].name });
  }
}

champ_list = champ_list.sort(function(a,b) {
  if(a.name < b.name) return -1;
  if(a.name > b.name) return 1;
  return 0;
});

var output = "select(name='champion')";
output += "\n  option(value='0') Select Champ";

for (i in champ_list) {
  output += `\n  option(value='${champ_list[i].id}') ${champ_list[i].name}`;
}

fs.writeFile("../views/partials/champion_select_box.jade", output, function (err) {
  if (err) {
    return console.log(err);
  }
  
  console.log("saved");
});