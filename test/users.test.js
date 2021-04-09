'use strict'

const assert = require('chai').assert

const H = require('./harness')

describe('#users', () => {
  H.requireFeature(H.Features.UserManagement, () => {
    const testGroup = H.genTestKey()
    const testUser = H.genTestKey()

    it('should successfully get all roles', async () => {
      var roles = await H.c.users().getRoles()
      assert.isAtLeast(roles.length, 1)
    })

    H.requireFeature(H.Features.UserGroupManagement, () => {
      it('should successfully upsert a group', async () => {
        await H.c.users().upsertGroup({
          name: testGroup,
          roles: ['ro_admin'],
        })
      })

      it('should successfully get a group', async () => {
        var grp = await H.c.users().getGroup(testGroup)
        assert.equal(grp.name, testGroup)
        assert.isAtLeast(grp.roles.length, 1)
      })

      it('should fail to get a missing group', async () => {
        await H.throwsHelper(async () => {
          await H.c.users().getGroup('missing-group-name')
        }, H.lib.GroupNotFoundError)
      })

      it('should successfully get all groups', async () => {
        var groups = await H.c.users().getAllGroups()
        assert.isAtLeast(groups.length, 1)
      })

      it('should successfully drop a group', async () => {
        await H.c.users().dropGroup(testGroup)
      })

      it('should fail to drop a missing group', async () => {
        await H.throwsHelper(async () => {
          await H.c.users().dropGroup('missing-group-name')
        }, H.lib.GroupNotFoundError)
      })
    })

    it('should successfully create a user', async () => {
      await H.c.users().upsertUser({
        username: testUser,
        password: 'password',
        roles: ['ro_admin'],
      })
    })

    it('should successfully get user', async () => {
      var user = await H.c.users().getUser(testUser)
      assert.equal(user.username, testUser)
    })

    it('should fail to get a missing user', async () => {
      await H.throwsHelper(async () => {
        await H.c.users().getUser('missing-user-name')
      }, H.lib.UserNotFoundError)
    })

    it('should fail to drop a user', async () => {
      await H.c.users().dropUser(testUser)
    })

    it('should fail to drop a missing user', async () => {
      await H.throwsHelper(async () => {
        await H.c.users().dropUser('missing-user-name')
      }, H.lib.UserNotFoundError)
    })
  })
})
