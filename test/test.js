var FireWatch = require('../index');
var Fs = require('fire-fs');

function reset () {
    Fs.rimrafSync("./test/foobar/");
    Fs.copySync("./test/test-data/", "./test/foobar");
}

describe('FireWatch', function () {
    it('should work for simple case', function ( done ) {
        reset();

        FireWatch.start( Fs.realpathSync("./test/foobar/"), function () {
            Fs.renameSync("./test/foobar/foo/foo-01/", "./test/foobar/bar/bar-04/");
            Fs.rimrafSync("./test/foobar/foo/bar-04/");
            Fs.writeFileSync("./test/foobar/foo/foobar.js", "Hello World!");
            Fs.writeFileSync("./test/foobar/foo/foo-02/foobar.js", "Hello World!");

            setTimeout( function () {
                FireWatch.stop( function ( results ) {
                    console.log( results );
                    done();
                });
            }, 500);
        } );
    });
});
