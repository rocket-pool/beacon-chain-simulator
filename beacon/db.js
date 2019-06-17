const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');


/**
 * Database service
 */
class DB {


    /**
     * Initialise
     * @param cmd Application commands
     * @param models Models to populate the default schema
     */
    init(cmd, models) {

        // Initialise database
        this.db = low(new FileSync(cmd.database));

        // Initialise default schema
        this.db.defaults(
            models.reduce((acc, val) => Object.assign(acc, val.getSchema()), {})
        ).write();

    }


}


// Exports
module.exports = DB;
