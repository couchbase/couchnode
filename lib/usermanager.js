'use strict';

const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');
const errors = require('./errors');
const qs = require('qs');

/**
 * Origin represents a server-side origin information
 *
 * @category Management
 */
class Origin {
  constructor() {
    /**
     * The type of this origin.
     *
     * @type {string}
     */
    this.type = '';

    /**
     * The name of this origin.
     *
     * @type {string}
     */
    this.name = undefined;
  }

  _fromData(data) {
    this.type = data.type;
    this.name = data.name;

    return this;
  }
}

/**
 * Role represents a server-side role object
 *
 * @category Management
 */
class Role {
  constructor() {
    /**
     * The name of the role (eg. data_access).
     *
     * @type {string}
     */
    this.name = '';

    /**
     * The bucket this role is scoped to.
     *
     * @type {string}
     */
    this.bucket = undefined;

    /**
     * The scope this role is scoped to.
     *
     * @type {string}
     * @uncommitted
     * @since 3.0.6
     */
    this.scope = undefined;

    /**
     * The collection this role is scoped to.
     *
     * @type {string}
     * @uncommitted
     * @since 3.0.6
     */
    this.collection = undefined;
  }

  _fromData(data) {
    this.name = data.role;
    this.bucket = data.bucket_name;
    this.scope = data.scope_name;
    this.collection = data.collection_name;
    return this;
  }

  static _toStrData(role) {
    if (typeof role === 'string') {
      return role;
    }

    if (role.bucket && role.scope && role.collection) {
      return `${role.name}[${role.bucket}:${role.scope}:${role.collection}]`;
    } else if (role.bucket && role.scope) {
      return `${role.name}[${role.bucket}:${role.scope}]`;
    } else if (role.bucket) {
      return `${role.name}[${role.bucket}]`;
    } else {
      return role.name;
    }
  }
}

/**
 * RoleAndDescription represents a server-side role object
 * along with description information.
 *
 * @category Management
 */
class RoleAndDescription extends Role {
  constructor() {
    super();

    /**
     * The displayed name for this role.
     *
     * @type {string}
     */
    this.displayName = '';

    /**
     * The description of this role.
     *
     * @type {string}
     */
    this.description = '';
  }

  _fromData(data) {
    super._fromData(data);

    this.displayName = data.name;
    this.description = data.description;

    return this;
  }
}

/**
 * RoleAndOrigin represents a server-side role object along
 * with the origin information which goes with the role.
 *
 * @category Management
 */
class RoleAndOrigin extends Role {
  constructor() {
    super();

    /**
     * The list of the origins associated with this role.
     *
     * @type {Origin[]}
     */
    this.origins = [];
  }

  _fromData(data) {
    super._fromData(data);

    this.origins = [];
    if (data.origins) {
      data.origins.forEach((originData) => {
        this.origins.push(new Origin()._fromData(originData));
      });
    }

    return this;
  }

  _hasUserOrigin() {
    if (this.origins.length === 0) {
      return true;
    }

    for (var i = 0; i < this.origins.length; ++i) {
      if (this.origins[i].type === 'user') {
        return true;
      }
    }
    return false;
  }
}

/**
 * User represents a server-side user object.
 *
 * @category Management
 */
class User {
  constructor() {
    /**
     * The username of the user.
     *
     * @type {string}
     */
    this.username = '';

    /**
     * The display-friendly name of the user.
     *
     * @type {string}
     */
    this.displayName = '';

    /**
     * The groups this user is a part of.
     *
     * @type {Group[]}
     */
    this.groups = [];

    /**
     * The roles this user has.
     *
     * @type {Role[]}
     */
    this.roles = [];

    /**
     * The password for this user.  Used only during creates/updates.
     *
     * @type {string}
     */
    this.password = '';
  }

  _fromData(data) {
    this.username = data.id;
    this.displayName = data.name;
    this.groups = data.groups;
    this.roles = [];
    if (data.roles) {
      data.roles.forEach((roleData) => {
        var role = new RoleAndOrigin()._fromData(roleData);
        if (role._hasUserOrigin()) {
          this.roles.push(new Role()._fromData(roleData));
        }
      });
    }

    return this;
  }

  static _toData(user) {
    var jsonData = {};
    jsonData.name = user.displayName;
    if (user.groups && user.groups.length > 0) {
      jsonData.groups = user.groups;
    }
    if (user.password) {
      jsonData.password = user.password;
    }
    if (user.roles && user.roles.length > 0) {
      jsonData.roles = user.roles.map((role) => Role._toStrData(role));
    }

    return jsonData;
  }
}

/**
 * UserAndMetadata represents a server-side user object with its
 * metadata information included.
 *
 * @category Management
 */
class UserAndMetadata extends User {
  constructor() {
    super();

    /**
     * The domain this user is within.
     *
     * @type {string}
     */
    this.domain = '';

    /**
     * The effective roles of this user.
     *
     * @type {Role[]}
     */
    this.effectiveRoles = [];

    /**
     * The effective roles with their origins for this user.
     *
     * @type {RoleAndOrigin[]}
     */
    this.effectiveRolesAndOrigins = [];

    /**
     * Indicates the last time the users password was changed.
     *
     * @type {number}
     */
    this.passwordChanged = null;

    /**
     * Groups assigned to this user from outside the system.
     *
     * @type {string[]}
     */
    this.externalGroups = [];
  }

  _fromData(data) {
    super._fromData(data);

    this.domain = data.domain;
    this.effectiveRoles = [];
    this.effectiveRolesAndOrigins = [];
    if (data.roles) {
      data.roles.forEach((roleData) => {
        this.effectiveRoles.push(new Role()._fromData(roleData));
      });
      data.roles.forEach((roleData) => {
        this.effectiveRolesAndOrigins.push(
          new RoleAndOrigin()._fromData(roleData)
        );
      });
    }
    this.passwordChanged = new Date(data.password_change_date);
    this.externalGroups = data.external_groups;

    return this;
  }

  user() {
    return User._fromData(this._userData);
  }
}

/**
 * Group represents a server Group object.
 *
 * @category Management
 */
class Group {
  constructor() {
    /**
     * The name of the group.
     *
     * @type {string}
     */
    this.name = '';

    /**
     * The description of this group.
     *
     * @type {string}
     */
    this.description = '';

    /**
     * The roles associated with this group.
     *
     * @type {Role[]}
     */
    this.roles = [];

    /**
     * The reference this group has to an external LDAP group.
     *
     * @type {string}
     */
    this.ldapGroupReference = undefined;
  }

  _fromData(data) {
    this.name = data.id;
    this.description = data.description;
    this.roles = [];
    if (data.roles) {
      data.roles.forEach((roleData) => {
        this.roles.push(new Role()._fromData(roleData));
      });
    }
    this.ldap_group_reference = data.ldapGroupReference;

    return this;
  }

  static _toData(group) {
    var jsonData = {};
    jsonData.description = group.description;
    if (group.roles && group.roles.length > 0) {
      jsonData.roles = group.roles.map((role) => Role._toStrData(role));
    }
    if (group.ldapGroupReference) {
      jsonData.ldapGroupReference = group.ldapGroupReference;
    }
    return jsonData;
  }
}

/**
 * UserManager is an interface which enables the management of users
 * within a cluster.
 *
 * @category Management
 */
class UserManager {
  /**
   * @hideconstructor
   */
  constructor(cluster) {
    this._cluster = cluster;
  }

  get _http() {
    return new HttpExecutor(this._cluster._getClusterConn());
  }

  /**
   * @typedef GetUserCallback
   * @type {function}
   * @param {Error} err
   * @param {User} res
   */
  /**
   *
   * @param {string} username
   * @param {Object} [options]
   * @param {string} [options.domainName]
   * @param {number} [options.timeout]
   * @param {GetUserCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<User>}
   */
  async getUser(username, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var domainName = 'local';
      if (options.domainName) {
        domainName = options.domainName;
      }

      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `/settings/rbac/users/${domainName}/${username}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        var baseerr = errors.makeHttpError(res);

        if (res.statusCode === 404) {
          throw new errors.UserNotFoundError(baseerr);
        }

        throw new errors.CouchbaseError('failed to get the user', baseerr);
      }

      var userData = JSON.parse(res.body);
      return new UserAndMetadata()._fromData(userData);
    }, callback);
  }

  /**
   * @typedef GetAllUsersCallback
   * @type {function}
   * @param {Error} err
   * @param {User[]} res
   */
  /**
   *
   * @param {Object} [options]
   * @param {string} [options.domainName]
   * @param {number} [options.timeout]
   * @param {GetAllUsersCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<User[]>}
   */
  async getAllUsers(options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var domainName = 'local';
      if (options.domainName) {
        domainName = options.domainName;
      }

      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `/settings/rbac/users/${domainName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new errors.CouchbaseError(
          'failed to get users',
          errors.makeHttpError(res)
        );
      }

      var usersData = JSON.parse(res.body);

      var users = [];
      usersData.forEach((userData) => {
        users.push(new UserAndMetadata()._fromData(userData));
      });

      return users;
    }, callback);
  }

  /**
   * @typedef UpsertUserCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {User} user
   * @param {Object} [options]
   * @param {string} [options.domainName]
   * @param {number} [options.timeout]
   * @param {UpsertUserCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async upsertUser(user, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var domainName = 'local';
      if (options.domainName) {
        domainName = options.domainName;
      }

      var userData = User._toData(user);
      if (userData.roles) {
        userData.roles = userData.roles.join(',');
      }
      var userQs = qs.stringify(userData);

      var res = await this._http.request({
        type: 'MGMT',
        method: 'PUT',
        path: `/settings/rbac/users/${domainName}/${user.username}`,
        contentType: 'application/x-www-form-urlencoded',
        body: userQs,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new errors.CouchbaseError(
          'failed to upsert user',
          errors.makeHttpError(res)
        );
      }

      return true;
    }, callback);
  }

  /**
   * @typedef DropUserCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {string} username
   * @param {Object} [options]
   * @param {string} [options.domainName]
   * @param {number} [options.timeout]
   * @param {DropUserCallback} [callback]

   * @throws {UserNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async dropUser(username, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var domainName = 'local';
      if (options.domainName) {
        domainName = options.domainName;
      }

      var res = await this._http.request({
        type: 'MGMT',
        method: 'DELETE',
        path: `/settings/rbac/users/${domainName}/${username}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        var baseerr = errors.makeHttpError(res);

        if (res.statusCode === 404) {
          throw new errors.UserNotFoundError(baseerr);
        }

        throw new errors.CouchbaseError('failed to drop the user', baseerr);
      }

      return true;
    }, callback);
  }

  /**
   * @typedef GetRolesCallback
   * @type {function}
   * @param {Error} err
   * @param {RoleAndDescription[]} res
   */
  /**
   *
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {GetRolesCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<RoleAndDescription[]>}
   */
  async getRoles(options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `/settings/rbac/roles`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new errors.CouchbaseError(
          'failed to get roles',
          errors.makeHttpError(res)
        );
      }

      var rolesData = JSON.parse(res.body);
      var roles = [];
      rolesData.forEach((roleData) => {
        roles.push(new RoleAndDescription()._fromData(roleData));
      });

      return roles;
    }, callback);
  }

  /**
   * @typedef GetGroupCallback
   * @type {function}
   * @param {Error} err
   * @param {Group} res
   */
  /**
   *
   * @param {string} groupName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {GetGroupCallback} [callback]
   *
   * @throws {GroupNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<Group>}
   */
  async getGroup(groupName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `/settings/rbac/groups/${groupName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        var baseerr = errors.makeHttpError(res);

        if (res.statusCode === 404) {
          throw new errors.GroupNotFoundError(baseerr);
        }

        throw new errors.CouchbaseError('failed to get the group', baseerr);
      }

      var groupData = JSON.parse(res.body);
      return new Group()._fromData(groupData);
    }, callback);
  }

  /**
   * @typedef GetAllGroupsCallback
   * @type {function}
   * @param {Error} err
   * @param {Group[]} res
   */
  /**
   *
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {GetAllGroupsCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<Group[]>}
   */
  async getAllGroups(options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `/settings/rbac/groups`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new errors.CouchbaseError(
          'failed to get groups',
          errors.makeHttpError(res)
        );
      }

      var groupsData = JSON.parse(res.body);

      var groups = [];
      groupsData.forEach((groupData) => {
        groups.push(new Group()._fromData(groupData));
      });

      return groups;
    }, callback);
  }

  /**
   * @typedef UpsertGroupCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {Group} group
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {UpsertGroupCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async upsertGroup(group, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var groupData = Group._toData(group);
      if (groupData.roles) {
        groupData.roles = groupData.roles.join(',');
      }
      var groupQs = qs.stringify(groupData);

      var res = await this._http.request({
        type: 'MGMT',
        method: 'PUT',
        path: `/settings/rbac/groups/${group.name}`,
        contentType: 'application/x-www-form-urlencoded',
        body: groupQs,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new errors.CouchbaseError(
          'failed to upsert group',
          errors.makeHttpError(res)
        );
      }

      return true;
    }, callback);
  }

  /**
   * @typedef DropGroupCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {string} username
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {DropGroupCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async dropGroup(groupName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'DELETE',
        path: `/settings/rbac/groups/${groupName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        var baseerr = errors.makeHttpError(res);

        if (res.statusCode === 404) {
          throw new errors.GroupNotFoundError(baseerr);
        }

        throw new errors.CouchbaseError('failed to drop the group', baseerr);
      }

      return true;
    }, callback);
  }
}
module.exports = UserManager;
