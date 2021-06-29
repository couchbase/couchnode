import { Cluster } from './cluster'
import { CouchbaseError, GroupNotFoundError, UserNotFoundError } from './errors'
import { HttpExecutor, HttpMethod, HttpServiceType } from './httpexecutor'
import { RequestSpan } from './tracing'
import { cbQsStringify, NodeCallback, PromiseHelper } from './utilities'

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
  name: string

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
  static _fromNsData(data: any): Origin {
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
  static _fromNsData(data: any): Role {
    return new Role({
      name: data.name,
      bucket: data.bucket_name,
      scope: data.scope_name,
      collection: data.collection_name,
    })
  }

  /**
   * @internal
   */
  static _toNsStr(role: string | Role): string {
    if (typeof role === 'string') {
      return role
    }

    if (role.bucket && role.scope && role.collection) {
      return `${role.name}[${role.bucket}:${role.scope}:${role.collection}]`
    } else if (role.bucket && role.scope) {
      return `${role.name}[${role.bucket}:${role.scope}]`
    } else if (role.bucket) {
      return `${role.name}[${role.bucket}]`
    } else {
      return role.name
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
  static _fromNsData(data: any): RoleAndDescription {
    return new RoleAndDescription({
      ...Role._fromNsData(data),
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
  static _fromNsData(data: any): RoleAndOrigin {
    let origins: Origin[]
    if (data.origins) {
      origins = data.origins.map((originData: any) =>
        Origin._fromNsData(originData)
      )
    } else {
      origins = []
    }

    return new RoleAndOrigin({
      ...Role._fromNsData(data),
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
  displayName: string

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
  static _fromNsData(data: any): User {
    let roles: Role[]
    if (data.roles) {
      roles = data.roles
        .filter((roleData: any) => {
          // Check whether or not this role has originated from the user directly
          // or whether it was through a group.
          if (!roleData.origins || roleData.origins.length === 0) {
            return false
          }
          return !!roleData.origins.find(
            (originData: any) => originData.type === 'user'
          )
        })
        .map((roleData: any) => Role._fromNsData(roleData))
    } else {
      roles = []
    }

    return new User({
      username: data.id,
      displayName: data.name,
      groups: data.groups,
      roles: roles,
      password: undefined,
    })
  }

  /**
   * @internal
   */
  static _toNsData(user: IUser): any {
    let groups: any = undefined
    if (user.groups && user.groups.length > 0) {
      groups = user.groups
    }

    let roles: any = undefined
    if (user.roles && user.roles.length > 0) {
      roles = user.roles.map((role) => Role._toNsStr(role)).join(',')
    }

    return {
      name: user.displayName,
      groups: groups,
      password: user.password,
      roles: roles,
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
  passwordChanged: Date

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
  static _fromNsData(data: any): UserAndMetadata {
    let effectiveRoles: RoleAndOrigin[]
    if (data.roles) {
      effectiveRoles = data.roles.map((roleData: any) =>
        RoleAndOrigin._fromNsData(roleData)
      )
    } else {
      effectiveRoles = []
    }

    return new UserAndMetadata({
      ...User._fromNsData(data),
      domain: data.domain,
      effectiveRoles: effectiveRoles,
      effectiveRolesAndOrigins: effectiveRoles,
      passwordChanged: new Date(data.password_change_date),
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
  static _fromNsData(data: any): Group {
    let roles: Role[]
    if (data.roles) {
      roles = data.roles.map((roleData: any) => Role._fromNsData(roleData))
    } else {
      roles = []
    }

    return new Group({
      name: data.id,
      description: data.description,
      roles: roles,
      ldapGroupReference: data.ldap_group_reference,
    })
  }

  /**
   * @internal
   */
  static _toNsData(group: IGroup): any {
    let roles: any = undefined
    if (group.roles && group.roles.length > 0) {
      roles = group.roles.map((role) => Role._toNsStr(role)).join(',')
    }

    return {
      description: group.description,
      roles: roles,
      ldap_group_reference: group.ldapGroupReference,
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
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

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
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

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
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

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
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

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
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

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
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

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
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

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
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

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
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

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

  private get _http() {
    return new HttpExecutor(this._cluster._getClusterConn())
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

    const domainName = options.domainName || 'local'
    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Get,
        path: `/settings/rbac/users/${domainName}/${username}`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        if (res.statusCode === 404) {
          throw new UserNotFoundError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to get the user', undefined, errCtx)
      }

      const userData = JSON.parse(res.body.toString())
      return UserAndMetadata._fromNsData(userData)
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

    const domainName = options.domainName || 'local'
    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Get,
        path: `/settings/rbac/users/${domainName}`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        throw new CouchbaseError('failed to get users', undefined, errCtx)
      }

      const usersData = JSON.parse(res.body.toString())
      const users = usersData.map((userData: any) =>
        UserAndMetadata._fromNsData(userData)
      )
      return users
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

    const domainName = options.domainName || 'local'
    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const userData = User._toNsData(user)

      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Put,
        path: `/settings/rbac/users/${domainName}/${user.username}`,
        contentType: 'application/x-www-form-urlencoded',
        body: cbQsStringify(userData),
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        throw new CouchbaseError('failed to upsert user', undefined, errCtx)
      }
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

    const domainName = options.domainName || 'local'
    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Delete,
        path: `/settings/rbac/users/${domainName}/${username}`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        if (res.statusCode === 404) {
          throw new UserNotFoundError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to drop the user', undefined, errCtx)
      }
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
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Get,
        path: `/settings/rbac/roles`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        throw new CouchbaseError('failed to get roles', undefined, errCtx)
      }

      const rolesData = JSON.parse(res.body.toString())
      const roles = rolesData.map((roleData: any) =>
        RoleAndDescription._fromNsData(roleData)
      )
      return roles
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

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Get,
        path: `/settings/rbac/groups/${groupName}`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        if (res.statusCode === 404) {
          throw new GroupNotFoundError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to get the group', undefined, errCtx)
      }

      const groupData = JSON.parse(res.body.toString())
      return Group._fromNsData(groupData)
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

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Get,
        path: `/settings/rbac/groups`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        throw new CouchbaseError('failed to get groups', undefined, errCtx)
      }

      const groupsData = JSON.parse(res.body.toString())
      const groups = groupsData.map((groupData: any) =>
        Group._fromNsData(groupData)
      )
      return groups
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

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const groupData = Group._toNsData(group)

      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Put,
        path: `/settings/rbac/groups/${group.name}`,
        contentType: 'application/x-www-form-urlencoded',
        body: cbQsStringify(groupData),
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        throw new CouchbaseError('failed to upsert group', undefined, errCtx)
      }
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

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Delete,
        path: `/settings/rbac/groups/${groupName}`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        if (res.statusCode === 404) {
          throw new GroupNotFoundError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to drop the group', undefined, errCtx)
      }
    }, callback)
  }
}
