var db = require('mongojs').connect('GrowlMovement', ["Favorites", "Beers", "History"]);

exports.favorite = function(beer) {
    return findBeer(beer);
  };

exports.unfavorite = function(beer) {
    return findBeer(beer);
  };

exports.removeUdidFromFeedback = function(id) {
    removeDeviceFromFavorites(id);
  };

exports.checkForNewBeers = function(newList, callback) {
  notifyUsersOfNewBeers(newList, callback);
}

exports.setAvailableBeers = function(beerList) {
  console.log('Updating avaiable beers...');
  // console.log(beerList);
    return setBeerList(beerList);
  }

exports.getFavoritesForBeer = function(beer, callback) {
    console.log('Getting Favorites...');
    // console.log(beer);
    findBeerAndExecuteCallback(beer, callback);
  }

exports.getAllBeers = function(callback) {
    console.log('Getting all beers...');
    loadAllBeers(callback);
  }

function findBeer(beer) {
  db.Favorites.findOne({'beer.name': beer.name, 'beer.brewer': beer.brewer}, function(err, result) {
    if (err) { console.log(err); return false; }
    else {
      console.log('FindBeer succeeded');
      // console.log(result);
      if (beer.fav == false && !result ) { return false; }
      else if (!result) {
        //create
        console.log('Creating new entry in Favorites');
        create(beer);
      } else if (beer.fav == false) {
        // delete
        console.log('Removing entry from Favorites');
        deleteBeer(beer);
      } else {
        // add entry
        console.log('Adding entry to record in Favorites');
        add(beer);
      }
    }
  });
}

function add(entry) {
  // console.log('add - entry - ' + entry);
  //var beer = entry;
  //if ((typeof beer) == 'undefined') create(entry);
  //entry.favorites.push(entry.udid);
  db.Favorites.update(
    {'beer.name': entry.name, 'beer.brewer': entry.brewer},
    { $push: {favorites: entry.udid} },
    (function(err) {
      // update done
      if(err) {
        console.log('Error updating ' + entry);
        console.log(err);
        return false;
      } else {
        console.log(entry.name + ' updated successfully');
      }
    })
  ); // end update
  return true;
}

function deleteBeer(entry) {
  // console.log('delete - entry - ' + entry);
  // var beer = entry;
  // if ((typeof beer) == 'undefined') return;
  db.Favorites.update(
    {'beer.name': entry.name, 'beer.brewer': entry.brewer},
    {$pull: {favorites: entry.udid} },
    (function (err) {
      if(err) {
        console.log('Error removing ' + entry);
        console.log(err);
        return false;
      } else {
        console.log( entry.name + ' removed successfully');
      }
    })
  );
  db.Favorites.remove({favorites: []}, function(err, result) {
    if (err) { console.log('Error removing entries with no favories'); }
    else {
      console.log('Entries with no favories cleaned out.');
    }
  });
  return true;
} // end delete

function create(entry) {
  // console.log('create - entry - ' + entry);
  db.Favorites.save(
    {beer: {
      name: entry.name,
      brewer: entry.brewer},
    favorites: [(entry.udid)]
  }, function(err, saved) {
    if (err || !saved) {
      console.log('error creating ' + entry);
      console.log(err);
      return false;
    } else {
      console.log(entry.name + ' created');
    }
  });
  return true;
}

function notifyUsersOfNewBeers(newList, callback) {
  console.log('Notify Users of New Beers');
  if (typeof callback === 'function') {
    db.Beers.find(function(err, result) {
      if(err || !result) { console.log("error getting old beer list"); }
      else {
        //console.log('Beers.find() result');
        console.log('Notifying users of new beers...');
        if (typeof result[0] === 'undefined') callback(newList, newList);
        else {
          // console.log(result[0].beerList);
          // function(oldBeers, newBeers) { }
          callback(result[0].beerList, newList);
        }
      }
    });
  }
}

function removeDeviceFromFavorites(id) {
  db.Favorites.find({}, function(err, results) {
    if(err || !results) { console.log('Error removed device from favorites Or no results'); console.log(err); }
    else if (results) {
      results.forEach(function(entry) {
        deleteBeer({name: entry.name, brewer: entry.brewer, udid: id});
      }); // end forEach results
    }
  }); // end Favorites.find()
}

function setBeerList(newlist) {
  console.log('Set Beer List');
  // console.log(newlist);
  // save to history too
  saveNewBeersToHistory(newlist);

  db.Beers.drop();
  db.Beers.save( {
    beerList: newlist
  }, function(err, saved) {
    if (err || !saved) {
      console.log('error saving beer list');
    } else {
      console.log('Set Beer List successful');
    }
  });
}

function findBeerAndExecuteCallback(beer, callback) {
  // If callback isnt set... BOOM!
  if(typeof callback !== 'function') {
    return;
  }
  db.Favorites.findOne({'beer.name': beer.name, 'beer.brewer': beer.brewer}, function(err, result) {
    if(err || !result) { console.log('No Beer Found when finding beer to execute callback'); return; }
    callback(result.favorites, beer.name);
  });
}

function loadAllBeers(callback) {
  if (typeof callback !== 'function') {
    return; // if not a funcion, bail
  }
  db.History.find({}, function(err, results) {
    if (err || !results) {
      console.log('Error loading all beers from history');
      return;
    }
    callback(results);
  }); // end db.find
}

function saveNewBeersToHistory(newBeers) {
  console.log('Saving new beers to history');
  newBeers.forEach(function(beer) {
    db.History.findOne({name: beer.name, brewer: beer.brewer}, function(err, result) {
//db.History.find({"_id": 1, fullHistory: {$elemMatch: {name: beer.name, brewer: beer.brewer} }}, function(err, result) {
      if (!err && !result) {
        console.log('no error and no results found when checking history');
        saveBeerToHistory(beer);
      }
      else if (err) { console.log("Error searching History"); console.log(err); }
      else {
        // console.log('Found Something');
        // console.log(result);
        // console.log(result === beer);
        if (result.name != beer.name || result.brewer != beer.brewer) {
           saveBeerToHistory(beer);
        }
      }
    }); // end db.find
  }); // end forEach
}

function saveBeerToHistory(beer) {
  console.log('Attempt save to history of beer');
  //db.History.update({"_id": 1}, {$push: {fullHistory: beer} }, function(err) {
  db.History.save(beer, function(err) {
    if (err) {
      console.log('Error adding beer to History');
      console.log(err);
    } else {
      console.log('Beer added to history successfully');
    }
  });
  console.log('Attempt to save to History complete');
}
