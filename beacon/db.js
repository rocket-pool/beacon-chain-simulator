const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');


// Database path
const DB_PATH = __dirname + '/db.json';


/**
 * Database service
 */
class DB {


    /**
     * Initialise
     * @param models Models to populate the default schema
     */
    init(models) {

        // Initialise database
        this.db = low(new FileSync(DB_PATH));

        // Initialise default schema
        this.db.defaults(
            models.reduce((acc, val) => Object.assign(acc, val.getSchema()), {})
        ).write();

    }


}


// Exports
module.exports = DB;
