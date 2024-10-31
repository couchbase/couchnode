'use strict'

const assert = require('chai').assert

const {
  Origin,
  Role,
  RoleAndOrigin,
  UserAndMetadata,
} = require('../lib/usermanager')
const H = require('./harness')

function toExpectedRole(name, bucket, scope, collection) {
  if (typeof bucket !== 'undefined') {
    if (typeof scope === 'undefined') {
      scope = '*'
    }
    if (typeof collection === 'undefined') {
      collection = '*'
    }
  }
  return new Role({
    name: name,
    bucket: bucket,
    scope: scope,
    collection: collection,
  })
}

function toExpectedRoleFromString(role) {
  // role[bucket-name:scope-name:collection-name]
  const tokens = role.split('[')
  const keyspaceTokens = tokens[1].replace(']', '').split(':')
  const name = tokens[0]
  const bucket = keyspaceTokens[0]
  let scope, collection
  // bucket-name:scope-name
  if (keyspaceTokens.length == 2) {
    scope = keyspaceTokens[1]
  } else if (keyspaceTokens.length == 3) {
    // bucket-name:scope-name:collection-name
    scope = keyspaceTokens[1]
    collection = keyspaceTokens[2]
  }
  return toExpectedRole(name, bucket, scope, collection)
}

function toExpectedUserAndMetadata(user, domain, groups) {
  const roles = user.roles.map((role) => {
    if (typeof role === 'string') {
      return toExpectedRoleFromString(role)
    }
    return toExpectedRole(role.name, role.bucket, role.scope, role.collection)
  })
  const rolesAndOrigins = roles.map((role) => {
    return new RoleAndOrigin({
      ...role,
      origins: [new Origin({ type: 'user' })],
    })
  })
  if (groups) {
    groups.forEach((g) => {
      g.roles.forEach((r) => {
        const role = toExpectedRole(r.name, r.bucket, r.scope, r.collection)
        rolesAndOrigins.push(
          new RoleAndOrigin({
            ...role,
            origins: [new Origin({ type: 'group', name: g.name })],
          })
        )
      })
    })
  }
  return new UserAndMetadata({
    username: user.username,
    displayName: user.displayName,
    domain: domain || 'local',
    groups: groups?.map((g) => g.name) || [],
    externalGroups: groups || [],
    roles: roles,
    effectiveRoles: rolesAndOrigins,
  })
}

function validateUserAndMetadata(actual, expected) {
  assert.strictEqual(actual.username, expected.username)
  assert.strictEqual(actual.domain, expected.domain)
  assert.strictEqual(actual.displayName, expected.displayName)
  if (actual.domain == 'local') {
    assert.isDefined(actual.passwordChanged)
  } else {
    assert.isUndefined(actual.passwordChanged)
  }
  assert.equal(expected.roles.length, actual.roles.length)
  assert.equal(expected.effectiveRoles.length, actual.effectiveRoles.length)
  expected.roles.forEach((role) => {
    const filteredRole = actual.roles.filter((r) => {
      return (
        r.name == role.name &&
        r.bucket == role.bucket &&
        r.scope == role.scope &&
        r.collection == role.collection
      )
    })
    assert.equal(filteredRole.length, 1)
  })
  expected.effectiveRoles.forEach((role) => {
    const filteredRole = actual.effectiveRoles.filter((r) => {
      return (
        r.name == role.name &&
        r.bucket == role.bucket &&
        r.scope == role.scope &&
        r.collection == role.collection
      )
    })
    assert.equal(filteredRole.length, 1)
    assert.deepStrictEqual(filteredRole[0].origins, role.origins)
  })
}

describe('#usersmgmt', function () {
  before(function () {
    H.skipIfMissingFeature(this, H.Features.UserManagement)
  })

  after(async function () {
    const allLocalUsers = await H.c.users().getAllUsers()
    allLocalUsers.forEach(async (user) => {
      await H.c.users().dropUser(user.username)
      await H.consistencyUtils.waitUntilUserDropped(user.username)
    })

    const allExternalUsers = await H.c
      .users()
      .getAllUsers({ domain: 'external' })
    allExternalUsers.forEach(async (user) => {
      await H.c.users().dropUser(user.username, { domainName: 'external' })
      await H.consistencyUtils.waitUntilUserDropped(user.username, 'external')
    })
  })

  /* eslint-disable mocha/no-setup-in-describe */
  describe('#user-roles', function () {
    const users = [
      {
        username: 'custom-user-1',
        displayName: 'Custom User 1',
        password: 's3cret!',
        roles: [
          new Role({ name: 'data_reader', bucket: 'default' }),
          new Role({ name: 'data_writer', bucket: 'default' }),
        ],
      },
      {
        username: 'custom-user-2',
        displayName: 'Custom User 2',
        password: 's3cret!',
        roles: [
          new Role({
            name: 'data_reader',
            bucket: 'default',
            scope: '_default',
          }),
          new Role({
            name: 'data_writer',
            bucket: 'default',
            scope: '_default',
          }),
        ],
      },
      {
        username: 'custom-user-3',
        displayName: 'Custom User 3',
        password: 's3cret!',
        roles: [
          new Role({
            name: 'data_reader',
            bucket: 'default',
            scope: '_default',
            collection: 'test',
          }),
          new Role({
            name: 'data_writer',
            bucket: 'default',
            scope: '_default',
            collection: 'test',
          }),
        ],
      },
      {
        username: 'custom-user-4',
        displayName: 'Custom User 4',
        password: 's3cret!',
        roles: ['data_reader[default]', 'data_writer[default]'],
      },
    ]
    users.forEach((user) => {
      it(`should successfully create local user: ${user.username}`, async function () {
        await H.c.users().upsertUser(user)
        await H.consistencyUtils.waitUntilUserPresent(user.username)
      })

      it(`should successfully create external user: ${user.username}`, async function () {
        const externalUser = Object.fromEntries(
          Object.entries(user).filter(([k]) => k !== 'password')
        )
        await H.c.users().upsertUser(externalUser, { domainName: 'external' })
        await H.consistencyUtils.waitUntilUserPresent(
          externalUser.username,
          'external'
        )
      })

      it(`should successfully get local user: ${user.username}`, async function () {
        const usermetadata = await H.c.users().getUser(user.username)
        const expected = toExpectedUserAndMetadata(user)
        validateUserAndMetadata(usermetadata, expected)
      })

      it(`should successfully get external user: ${user.username}`, async function () {
        const usermetadata = await H.c
          .users()
          .getUser(user.username, { domainName: 'external' })
        const expected = toExpectedUserAndMetadata(user, 'external')
        validateUserAndMetadata(usermetadata, expected)
      })

      it('should successfully get all local users', async function () {
        const allUsers = await H.c.users().getAllUsers()
        assert.isArray(allUsers)
        assert.equal(allUsers.length, 1)
        const expected = toExpectedUserAndMetadata(user)
        validateUserAndMetadata(allUsers[0], expected)
      })

      it('should successfully get all external users', async function () {
        const allUsers = await H.c
          .users()
          .getAllUsers({ domainName: 'external' })
        assert.isArray(allUsers)
        assert.equal(allUsers.length, 1)
        const expected = toExpectedUserAndMetadata(user, 'external')
        validateUserAndMetadata(allUsers[0], expected)
      })

      it(`should successfully update local user: ${user.username}`, async function () {
        user.roles = [new Role({ name: 'ro_admin' })]
        await H.c.users().upsertUser(user)
        await H.consistencyUtils.waitUntilUserPresent(user.username)
      })

      it(`should successfully get updated local user: ${user.username}`, async function () {
        const usermetadata = await H.c.users().getUser(user.username)
        const expected = toExpectedUserAndMetadata(user)
        validateUserAndMetadata(usermetadata, expected)
      })

      it(`should successfully drop local user: ${user.username}`, async function () {
        await H.c.users().dropUser(user.username)
        await H.consistencyUtils.waitUntilUserDropped(user.username)
      })

      it(`should successfully drop external user: ${user.username}`, async function () {
        await H.c.users().dropUser(user.username, { domainName: 'external' })
        await H.consistencyUtils.waitUntilUserDropped(user.username, 'external')
      })
    })
  })

  /* eslint-disable mocha/no-setup-in-describe */
  describe('#usernotfound', function () {
    it('should fail to get a missing user', async function () {
      await H.throwsHelper(async () => {
        await H.c.users().getUser('missing-user-name')
      }, H.lib.UserNotFoundError)
    })

    it('should fail to drop a missing user', async function () {
      await H.throwsHelper(async () => {
        await H.c.users().dropUser('missing-user-name')
      }, H.lib.UserNotFoundError)
    })
  })

  /* eslint-disable mocha/no-setup-in-describe */
  describe('#invalidargument', function () {
    const user = {
      username: 'custom-user-1',
      displayName: 'Custom User 1',
      password: 's3cret!',
      roles: [
        new Role({ name: 'data_reader', bucket: 'default' }),
        new Role({ name: 'data_writer', bucket: 'default' }),
      ],
    }

    it('should fail to upsert external user w/ password', async function () {
      await H.throwsHelper(async () => {
        await H.c.users().upsertUser(user, { domainName: 'external' })
      }, H.lib.InvalidArgumentError)
    })

    it('should fail to upsert user with invalid domain', async function () {
      await H.throwsHelper(async () => {
        await H.c.users().upsertUser(user, { domainName: 'not-a-domain' })
      }, H.lib.InvalidArgumentError)
    })

    it('should fail to get a user with invalid domain', async function () {
      await H.throwsHelper(async () => {
        await H.c.users().getUser(user.username, { domainName: 'not-a-domain' })
      }, H.lib.InvalidArgumentError)
    })

    it('should fail to drop a user with invalid domain', async function () {
      await H.throwsHelper(async () => {
        await H.c
          .users()
          .dropUser(user.username, { domainName: 'not-a-domain' })
      }, H.lib.InvalidArgumentError)
    })

    it('should fail to get all users with invalid domain', async function () {
      await H.throwsHelper(async () => {
        await H.c.users().getAllUsers({ domainName: 'not-a-domain' })
      }, H.lib.InvalidArgumentError)
    })
  })

  /* eslint-disable mocha/no-setup-in-describe */
  describe('#roles', function () {
    const user = {
      username: 'custom-user-1',
      displayName: 'Custom User 1',
      password: 's3cret!',
      roles: [],
    }

    it('should successfully get all roles', async function () {
      var roles = await H.c.users().getRoles()
      assert.isAtLeast(roles.length, 1)
    })

    it('should fail to upsert user with invalid roles', async function () {
      user.roles.push(new Role({ name: 'data_reader', bucket: 'not-a-bucket' }))
      await H.throwsHelper(async () => {
        await H.c.users().upsertUser(user, { domainName: 'external' })
      }, H.lib.InvalidArgumentError)
    })
  })

  /* eslint-disable mocha/no-setup-in-describe */
  describe('#user-groups', function () {
    const groups = [
      {
        name: 'test-group-1',
        roles: [
          new Role({ name: 'data_reader', bucket: '*' }),
          new Role({ name: 'data_writer', bucket: '*' }),
        ],
        description: 'test-group-1 description',
      },
      {
        name: 'test-group-2',
        roles: [new Role({ name: 'ro_admin' })],
        description: 'test-group-2 description',
      },
    ]

    const groupRoles = [
      {
        name: 'data_reader',
        bucket: '*',
        scope: '*',
        collection: '*',
      },
      {
        name: 'data_writer',
        bucket: '*',
        scope: '*',
        collection: '*',
      },
    ]

    const user = {
      username: 'custom-user-1',
      displayName: 'Custom User 1',
      password: 's3cret!',
      roles: [
        new Role({ name: 'data_reader', bucket: 'default' }),
        new Role({ name: 'data_writer', bucket: 'default' }),
      ],
    }

    before(function () {
      H.skipIfMissingFeature(this, H.Features.UserGroupManagement)
    })

    groups.forEach((group) => {
      it(`should successfully upsert a group: ${group.name}`, async function () {
        await H.c.users().upsertGroup(group)
        await H.consistencyUtils.waitUntilGroupPresent(group.name)
      })

      it(`should successfully get a group: ${group.name}`, async function () {
        const grp = await H.c.users().getGroup(group.name)
        assert.equal(grp.name, group.name)
        assert.equal(grp.description, group.description)
        if (group.name == 'test-group-1') {
          assert.equal(grp.roles.length, groupRoles.length)
          groupRoles.forEach((gr) => {
            const filteredRole = grp.roles.filter((r) => {
              return (
                r.name == gr.name &&
                r.bucket == gr.bucket &&
                r.scope == gr.scope &&
                r.collection == gr.collection
              )
            })
            assert.equal(filteredRole.length, 1)
          })
        } else {
          assert.deepStrictEqual(grp.roles, group.roles)
        }
      })
    })

    it('should fail to get a missing group', async function () {
      await H.throwsHelper(async () => {
        await H.c.users().getGroup('missing-group-name')
      }, H.lib.GroupNotFoundError)
    })

    it('should successfully get all groups', async function () {
      const allGroups = await H.c.users().getAllGroups()
      assert.isAtLeast(allGroups.length, 2)
      assert.include(
        allGroups.map((g) => g.name),
        groups[0].name
      )
      assert.include(
        allGroups.map((g) => g.name),
        groups[1].name
      )
    })

    it('should successfully upsert user with groups', async function () {
      user.groups = groups.map((g) => g.name)
      await H.c.users().upsertUser(user)
      await H.consistencyUtils.waitUntilUserPresent(user.username)
    })

    it('should successfully get user with groups', async function () {
      const usermetadata = await H.c.users().getUser(user.username)
      const expected = toExpectedUserAndMetadata(user, 'local', groups)
      validateUserAndMetadata(usermetadata, expected)
      await H.consistencyUtils.waitUntilUserPresent(user.username)
    })

    it('should successfully drop user with groups', async function () {
      await H.c.users().dropUser(user.username)
      await H.consistencyUtils.waitUntilUserDropped(user.username)
    })

    groups.forEach((group) => {
      it(`should successfully drop a group: ${group.name}`, async function () {
        await H.c.users().dropGroup(group.name)
        await H.consistencyUtils.waitUntilGroupDropped(group.name)
      })
    })

    it('should fail to drop a missing group', async function () {
      await H.throwsHelper(async () => {
        await H.c.users().dropGroup('missing-group-name')
      }, H.lib.GroupNotFoundError)
    })
  })

  /* eslint-disable mocha/no-setup-in-describe */
  describe('#change-password', function () {
    it('should successfully change current user password', async function () {
      var changePasswordUsername = 'changePasswordUser'
      var changeUserPassword = 'changeUserPassword'
      var newPassword = 'newPassword'

      await H.c.users().upsertUser({
        username: changePasswordUsername,
        password: changeUserPassword,
        roles: ['admin'],
      })
      await H.consistencyUtils.waitUntilUserPresent(changePasswordUsername)

      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        try {
          var cluster = await H.lib.Cluster.connect(H.connStr, {
            username: changePasswordUsername,
            password: changeUserPassword,
          })
        } catch (e) {
          if (e instanceof H.lib.AuthenticationFailureError) {
            await H.sleep(100)
            continue
          }
        }
        break
      }
      await cluster.users().changePassword(newPassword)

      //Assert can connect using new password
      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        try {
          var success_cluster = await H.lib.Cluster.connect(H.connStr, {
            username: changePasswordUsername,
            password: newPassword,
          })
        } catch (e) {
          if (e instanceof H.lib.AuthenticationFailureError) {
            await H.sleep(100)
            continue
          }
        }
        await success_cluster.close()
        break
      }

      //Assert cannot authenticate using old credentials
      await H.throwsHelper(async () => {
        await H.lib.Cluster.connect(H.connStr, {
          username: changePasswordUsername,
          password: changeUserPassword,
        })
      }, H.lib.AuthenticationFailureError)

      await cluster.close()
    }).timeout(10000)
  })
})
