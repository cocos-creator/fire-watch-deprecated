var Fs = require('fire-fs');
var Path = require('fire-path');
var Util = require ('util');
var EventEmitter = require ('events');
var Globby = require ('globby');

var commandPriority = { delete: 0, new: 1, change: 2 };
var globalDiff = true;

function _dbgPrintResults ( results ) {
  for ( var p in results ) {
    console.log( '%s: %s', results[p].command, results[p].path );
  }
}

function _addResult ( results, command, path, isDirectory ) {
  var result = results[path];
  if ( result ) {
    if ( result.isDirectory !== isDirectory ) {
      throw new Error('We not support file and directory share the same path ' + path );
    }

    if ( commandPriority[result.command] > commandPriority[command] ) {
      result.command = command;
    }

    return;
  }

  results[path] = {
    command: command,
    path: path,
    isDirectory: isDirectory
  };
}

function _flush ( watcher ) {
  //
  var sortedChanges = watcher._changes;
  watcher._changes = [];
  sortedChanges.sort( function ( a, b ) {
    return a.path.localeCompare(b.path);
  });

  //
  var results = _computeResults( watcher._fileInfos, sortedChanges );
  watcher._fileInfos = {};

  //
  watcher.emit( 'changed', results );
}

function _getFiles ( path ) {
  if ( !Fs.existsSync(path) ) {
    return [];
  }

  return Fs.readdirSync(path)
    .filter( function ( name ) {
      return name[0] !== '.';
    })
    .map( function ( name ) {
      return Path.join( path, name );
    })
    ;
}

function _fastRemove ( array, nth, len ) {
  array[nth] = array[len-1];
}

function _computeResults ( fileInfos, changes ) {

  var results = {};

  for ( var i = 0; i < changes.length; ++i ) {
    var changeInfo = changes[i];
    var fileInfo = fileInfos[changeInfo.path];

    if ( !fileInfo ) {
      _addResult( results, 'new', changeInfo.path, Fs.statSync(changeInfo.path).isDirectory() );
      continue;
    }

    // get file
    var path, stat, stat2;

    // if changed file is folder
    if ( fileInfo.stat.isDirectory() ) {
      var oldFiles = fileInfo.children.slice();
      var newFiles = _getFiles( fileInfo.path );
      var sameFiles = [];
      var oldLen = oldFiles.length;
      var newLen = newFiles.length;
      var j, jj;

      for ( j = 0; j < newLen; ++j ) {
        for ( jj = 0; jj < oldLen; ++jj ) {
          var newpath = newFiles[j];
          var oldpath = oldFiles[jj];

          if ( newpath === oldpath ) {
            sameFiles.push(newpath);

            _fastRemove( newFiles, j, newLen );
            newLen -= 1; --j;

            _fastRemove( oldFiles, jj, oldLen );
            oldLen -= 1; --jj;

            break;
          }
        }
      }

      for ( j = 0; j < newLen; ++j ) {
        path = newFiles[j];
        stat = Fs.statSync(path);
        _addResult( results, 'new', path, stat.isDirectory() );
      }

      for ( j = 0; j < oldLen; ++j ) {
        path = oldFiles[j];
        stat = fileInfos[path].stat;
        _addResult( results, 'delete', path, stat.isDirectory() );
      }

      for ( j = 0; j < sameFiles.length; ++j ) {
        path = sameFiles[j];
        stat = fileInfos[path].stat;
        stat2 = Fs.statSync(path);
        if ( stat.isFile() && stat.mtime.getTime() !== stat2.mtime.getTime() ) {
          _addResult( results, 'change', path, false );
        }
      }
    } else {
      if ( changeInfo.command === 'change' ) {
        _addResult( results, 'change', changeInfo.path, false );
      }
      else if ( changeInfo.command === 'delete' ) {
        if ( !Fs.existsSync(changeInfo.path) ) {
          _addResult( results, 'delete', changeInfo.path, false );
        }
        else {
          _addResult( results, 'change', changeInfo.path, false );
        }
      }
      // DISABLE
      // else if ( changeInfo.command === 'rename' ) {
      //   if ( !Fs.existsSync(changeInfo.path) ) {
      //     _addResult( results, 'delete', changeInfo.path, false );
      //   }
      //   else {
      //     _addResult( results, 'change', changeInfo.path, false );
      //   }

      //   if ( Path.contains( file.base, changeInfo.relatedPath ) ) {
      //     _addResult( results, 'new', changeInfo.relatedPath, false );
      //   }
      // }
    }
  }

  var resultList = [];
  for ( var p in results ) {
    resultList.push(results[p]);
  }
  resultList.sort( function ( a, b ) {
    var compareCommand = commandPriority[a.command] - commandPriority[b.command];
    if ( compareCommand !== 0 ) {
      return compareCommand;
    }

    return a.path.localeCompare(b.path);
  } );

  var lastDirectory = null;
  resultList = resultList.filter( function ( r ) {
    if (
      lastDirectory &&
      lastDirectory.command === r.command &&
      Path.contains( lastDirectory.path, r.path )
    ) {
      return false;
    }

    if ( r.isDirectory ) {
      lastDirectory = r;
    }

    return true;
  });

  return resultList;
}

function FireWatch () {
  EventEmitter.call(this);

  this._fileInfos = {};
  this._changes = [];
}
Util.inherits( FireWatch, EventEmitter );

FireWatch.prototype.stop = function ( cb ) {
  setTimeout( function () {
    _flush(this);

    if ( cb ) {
      cb();
    }
  }.bind(this), 100 );
};

FireWatch.start = function (roots, cb ) {
  if ( !Array.isArray(roots) ) {
    roots = [roots];
  }

  roots = roots.map(function (root) {
    return Path.normalize(root).replace(/\/$/, '');
  });

  var watcher = new FireWatch();
  var src = [];
  roots.forEach(function (root) {
    var rootParent = Path.dirname(root);
    watcher._fileInfos[rootParent] = {
      path: rootParent,
      stat: null,
      children: []
    };
    src.push(root);
    src.push(Path.join(root,'**/*'));
  });

  Globby(src, function ( err, paths ) {
    var unknowns = [];

    paths.forEach(function ( path ) {
      path = Path.normalize(path);

      // NOTE: it is possible we delete file between Globby and statSync
      // for this files, we will skip watch their changes
      var stat;
      try {
        stat = Fs.statSync(path);
      } catch (err) {
        unknowns.push(path);
        return;
      }

      watcher._fileInfos[path] = {
        path: path,
        stat: stat,
        children: [],
      };

      var parent = watcher._fileInfos[Path.dirname(path)];
      parent.children.push( path );

      if ( stat.isDirectory() ) {
        watcher._changes.push({
          path: path,
          command: 'change',
        });
      }
    });

    if ( unknowns.length ) {
      watcher.emit( 'unknown-changed', unknowns );
    }

    if ( cb ) {
      cb ();
    }
  });

  return watcher;
};

module.exports = FireWatch;
