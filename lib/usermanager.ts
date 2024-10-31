import { Cluster } from './cluster'
import {
  CppManagementRbacGroup,
  CppManagementRbacOrigin,
  CppManagementRbacRole,
  CppManagementRbacRoleAndDescription,
  CppManagementRbacRoleAndOrigins,
  CppManagementRbacUser,
  CppManagementRbacUserAndMetadata,
} from './binding'
import {
  authDomainToCpp,
  authDomainFromCpp,
  errorFromCpp,
} from './bindingutilities'
import { NodeCallback, PromiseHelper } from './utilities'

/**
 * Contains information about an origin for a role.
 *
 * @category Management
 */
export class Origin {
  /**
   * The type of this origin.
   */
  type: string

  /**
   * The name of this origin.
   */
  name?: string

  /**
   * @internal
   */
  constructor(data: Origin) {
    this.type = data.type
    this.name = data.name
  }

  /**
   * @internal
   */
  static _fromCppData(data: CppManagementRbacOrigin): Origin {
    return new Origin({
      type: data.type,
      name: data.name,
    })
  }
}

/**
 * Contains information about a role.
 *
 * @category Management
 */
export class Role {
  /**
   * The name of the role.
   */
  name: string

  /**
   * The bucket this role applies to.
   */
  bucket: string | undefined

  /**
   * The scope this role applies to.
   */
  scope: string | undefined

  /**
   * The collection this role applies to.
   */
  collection: string | undefined

  /**
   * @internal
   */
  constructor(data: Role) {
    this.name = data.name
    this.bucket = data.bucket
    this.scope = data.scope
    this.collection = data.collection
  }

  /**
   * @internal
   */
  static _fromCppData(data: CppManagementRbacRole): Role {
    return new Role({
      name: data.name,
      bucket: data.bucket,
      scope: data.scope,
      collection: data.collection,
    })
  }

  /**
   * @internal
   */
  static _toCppData(data: Role): CppManagementRbacRole {
    return {
      name: data.name,
      bucket: data.bucket,
      scope: data.scope,
      collection: data.collection,
    }
  }
}

/**
 * Contains information about a role along with its description.
 *
 * @category Management
 */
export class RoleAndDescription extends Role {
  /**
   * The user-friendly display name for this role.
   */
  displayName: string

  /**
   * The description of this role.
   */
  description: string

  /**
   * @internal
   */
  constructor(data: RoleAndDescription) {
    super(data)
    this.displayName = data.displayName
    this.description = data.description
  }

  /**
   * @internal
   */
  static _fromCppData(
    data: CppManagementRbacRoleAndDescription
  ): RoleAndDescription {
    const role = Role._fromCppData(data)
    return new RoleAndDescription({
      ...role,
      displayName: data.name,
      description: data.description,
    })
  }
}

/**
 * Contains information about a role along with its origin.
 *
 * @category Management
 */
export class RoleAndOrigin extends Role {
  /**
   * The origins for this role.
   */
  origins: Origin[]

  /**
   * @internal
   */
  constructor(data: RoleAndOrigin) {
    super(data)
    this.origins = data.origins
  }

  /**
   * @internal
   */
  static _fromCppData(data: CppManagementRbacRoleAndOrigins): RoleAndOrigin {
    const origins = data.origins.map((origin) => Origin._fromCppData(origin))
    return new RoleAndOrigin({
      ...Role._fromCppData({
        name: data.name,
        bucket: data.bucket,
        scope: data.scope,
        collection: data.collection,
      }),
      origins,
    })
  }
}

/**
 * Specifies information about a user.
 *
 * @category Management
 */
export interface IUser {
  /**
   * The username of the user.
   */
  username: string

  /**
   * The display name of the user.
   */
  displayName?: string

  /**
   * The groups associated with this user.
   */
  groups?: string[]

  /**
   * The roles associates with this user.
   */
  roles?: (Role | string)[]

  /**
   * The password for this user.
   */
  password?: string
}

/**
 * Contains information about a user.
 *
 * @category Management
 */
export class User implements IUser {
  /**
   * The username of the user.
   */
  username: string

  /**
   * The display name of the user.
   */
  displayName?: string

  /**
   * The groups associated with this user.
   */
  groups: string[]

  /**
   * The roles associates with this user.
   */
  roles: Role[]

  /**
   * This is never populated in a result returned by the server.
   */
  password: undefined

  /**
   * @internal
   */
  constructor(data: User) {
    this.username = data.username
    this.displayName = data.displayName
    this.groups = data.groups
    this.roles = data.roles
  }

  /**
   * @internal
   */
  static _fromCppData(data: CppManagementRbacUser): User {
    return new User({
      username: data.username,
      displayName: data.display_name,
      groups: data.groups,
      roles: data.roles.map((role) => Role._fromCppData(role)),
      password: undefined,
    })
  }

  /**
   * @internal
   */
  static _toCppData(data: IUser): CppManagementRbacUser {
    const roles: CppManagementRbacRole[] = []
    if (data.roles) {
      data.roles.forEach((role) => {
        if (typeof role === 'string') {
          roles.push({
            name: role,
          })
        } else {
          roles.push(Role._toCppData(role))
        }
      })
    }
    return {
      username: data.username,
      display_name: data.displayName,
      groups: data.groups ? data.groups : [],
      roles: roles,
      password: data.password,
    }
  }
}

/**
 * Contains information about a user along with some additional meta-data
 * about that user.
 *
 * @category Management
 */
export class UserAndMetadata extends User {
  /**
   * The domain this user is part of.
   */
  domain: string

  /**
   * The effective roles that are associated with this user.
   */
  effectiveRoles: RoleAndOrigin[]

  /**
   * The last time the users password was changed.
   */
  passwordChanged?: Date

  /**
   * The external groups that this user is associated with.
   */
  externalGroups: string[]

  /**
   * Same as {@link effectiveRoles}, which already contains the roles
   * including their origins.
   *
   * @deprecated Use {@link effectiveRoles} instead.
   */
  get effectiveRolesAndOrigins(): RoleAndOrigin[] {
    return this.effectiveRoles
  }

  /**
   * @internal
   */
  constructor(data: UserAndMetadata) {
    super(data)
    this.domain = data.domain
    this.effectiveRoles = data.effectiveRoles
    this.passwordChanged = data.passwordChanged
    this.externalGroups = data.externalGroups
  }

  /**
   * @internal
   */
  static _fromCppData(data: CppManagementRbacUserAndMetadata): UserAndMetadata {
    const user = User._fromCppData({
      username: data.username,
      display_name: data.display_name,
      groups: data.groups,
      roles: data.roles,
      password: data.password,
    })
    const effectiveRoles = data.effective_roles.map((erole) =>
      RoleAndOrigin._fromCppData(erole)
    )
    return new UserAndMetadata({
      ...user,
      domain: authDomainFromCpp(data.domain),
      effectiveRoles: effectiveRoles,
      effectiveRolesAndOrigins: effectiveRoles,
      passwordChanged: data.password_changed
        ? new Date(data.password_changed)
        : undefined,
      externalGroups: data.external_groups,
    })
  }
}

/**
 * Specifies information about a group.
 *
 * @category Management
 */
export interface IGroup {
  /**
   * The name of the group.
   */
  name: string

  /**
   * The description for the group.
   */
  description?: string

  /**
   * The roles which are associated with this group.
   */
  roles?: (Role | string)[]

  /**
   * The LDAP group that this group is associated with.
   */
  ldapGroupReference?: string
}

/**
 * Contains information about a group.
 *
 * @category Management
 */
export class Group {
  /**
   * The name of the group.
   */
  name: string

  /**
   * The description for the group.
   */
  description: string

  /**
   * The roles which are associated with this group.
   */
  roles: Role[]

  /**
   * The LDAP group that this group is associated with.
   */
  ldapGroupReference: string | undefined

  /**
   * @internal
   */
  constructor(data: Group) {
    this.name = data.name
    this.description = data.description
    this.roles = data.roles
    this.ldapGroupReference = data.ldapGroupReference
  }

  /**
   * @internal
   */
  static _fromCppData(data: CppManagementRbacGroup): Group {
    return new Group({
      name: data.name,
      description: data.description || '',
      roles: data.roles.map((role) => Role._fromCppData(role)),
      ldapGroupReference: data.ldap_group_reference,
    })
  }

  /**
   * @internal
   */
  static _toCppData(data: IGroup): CppManagementRbacGroup {
    const roles: CppManagementRbacRole[] = []
    if (data.roles) {
      data.roles.forEach((role) => {
        if (typeof role === 'string') {
          roles.push({
            name: role,
          })
        } else {
          roles.push(Role._toCppData(role))
        }
      })
    }
    return {
      name: data.name,
      description: data.description,
      roles: roles,
      ldap_group_reference: data.ldapGroupReference,
    }
  }
}

/**
 * @category Management
 */
export interface GetUserOptions {
  /**
   * The domain to look in for the user.
   */
  domainName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetAllUsersOptions {
  /**
   * The domain to look in for users.
   */
  domainName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface UpsertUserOptions {
  /**
   * The domain to upsert the user within.
   */
  domainName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface ChangePasswordOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropUserOptions {
  /**
   * The domain to drop the user from.
   */
  domainName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetRolesOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetGroupOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetAllGroupsOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface UpsertGroupOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropGroupOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * UserManager is an interface which enables the management of users,
 * groups and roles for the cluster.
 *
 * @category Management
 */
export class UserManager {
  private _cluster: Cluster

  /**
   * @internal
   */
  constructor(cluster: Cluster) {
    this._cluster = cluster
  }

  /**
   * Returns a specific user by their username.
   *
   * @param username The username of the user to fetch.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getUser(
    username: string,
    options?: GetUserOptions,
    callback?: NodeCallback<UserAndMetadata>
  ): Promise<UserAndMetadata> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const cppDomain = authDomainToCpp(options.domainName || 'local')
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementUserGet(
        {
          username: username,
          domain: cppDomain,
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(null, UserAndMetadata._fromCppData(resp.user))
        }
      )
    }, callback)
  }

  /**
   * Returns a list of all existing users.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllUsers(
    options?: GetAllUsersOptions,
    callback?: NodeCallback<UserAndMetadata[]>
  ): Promise<UserAndMetadata[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const cppDomain = authDomainToCpp(options.domainName || 'local')
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementUserGetAll(
        {
          domain: cppDomain,
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const users = resp.users.map((user) =>
            UserAndMetadata._fromCppData(user)
          )
          wrapCallback(null, users)
        }
      )
    }, callback)
  }

  /**
   * Creates or updates an existing user.
   *
   * @param user The user to update.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async upsertUser(
    user: IUser,
    options?: UpsertUserOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const cppDomain = authDomainToCpp(options.domainName || 'local')
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementUserUpsert(
        {
          user: User._toCppData(user),
          domain: cppDomain,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Change password for the currently authenticatd user.
   *
   * @param newPassword The new password to be applied.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async changePassword(
    newPassword: string,
    options?: ChangePasswordOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementChangePassword(
        {
          newPassword: newPassword,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Drops an existing user.
   *
   * @param username The username of the user to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropUser(
    username: string,
    options?: DropUserOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const cppDomain = authDomainToCpp(options.domainName || 'local')
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementUserDrop(
        {
          username: username,
          domain: cppDomain,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Returns a list of roles available on the server.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getRoles(
    options?: GetRolesOptions,
    callback?: NodeCallback<Role[]>
  ): Promise<Role[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementRoleGetAll(
        {
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const roles = resp.roles.map((role) => Role._fromCppData(role))
          wrapCallback(null, roles)
        }
      )
    }, callback)
  }

  /**
   * Returns a group by it's name.
   *
   * @param groupName The name of the group to retrieve.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getGroup(
    groupName: string,
    options?: GetGroupOptions,
    callback?: NodeCallback<Group>
  ): Promise<Group> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementGroupGet(
        {
          name: groupName,
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(null, Group._fromCppData(resp.group))
        }
      )
    }, callback)
  }

  /**
   * Returns a list of all existing groups.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllGroups(
    options?: GetAllGroupsOptions,
    callback?: NodeCallback<Group[]>
  ): Promise<Group[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementGroupGetAll(
        {
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const groups = resp.groups.map((group) => Group._fromCppData(group))
          wrapCallback(null, groups)
        }
      )
    }, callback)
  }

  /**
   * Creates or updates an existing group.
   *
   * @param group The group to update.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async upsertGroup(
    group: IGroup,
    options?: UpsertGroupOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementGroupUpsert(
        {
          group: Group._toCppData(group),
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Drops an existing group.
   *
   * @param groupName The name of the group to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropGroup(
    groupName: string,
    options?: DropGroupOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementGroupDrop(
        {
          name: groupName,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }
}
