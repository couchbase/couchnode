import { describe, expect } from 'vitest'

import type { Cluster } from '../../../lib/cluster'
import {
  AuthenticationFailureError,
  GroupNotFoundError,
  InvalidArgumentError,
  UserNotFoundError,
} from '../../../lib/errors'
import { Group, Origin, Role } from '../../../lib/usermanager'
import type { IGroup, IUser, UserAndMetadata } from '../../../lib/usermanager'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { expectThrows } from '../../asserts/errors'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import { pollUntil, sleep } from '../../infra/retry'
import { defineSuite } from '../../infra/suite'

// An ordered story per user, in declaration order (which Vitest follows):
// create local, create external, read back, list, update local, read the
// update, drop both.
//
// Users and groups are cluster-wide, so each is created under a name unique to
// the run and file (`inRun`), and a concurrent run against the same cluster
// neither sees nor drops it. The declared name is a label: test titles keep it
// so they read the same on every run, and it prefixes the created name.
//
// Teardown drops only what this suite made, registered as each is created;
// dropping every user would destroy anything else's. The domain option is
// `domainName`: passing `domain` silently lists the local users again.
//
// "Get all users" asserts on this suite's own users, not on an exact count,
// which holds only on an emptied cluster.
//
// Collection-scoped roles name `_default._default`, which always exists.

const CREDENTIAL_DEADLINE_MS = 10_000
/** The new password works a moment after `changePassword`, not at once. */
const PASSWORD_SETTLE_MS = 500
const OLD_PASSWORD_ATTEMPTS = 5
const OLD_PASSWORD_DELAY_MS = 500

const EXTERNAL = 'external'
const LOCAL = 'local'

const MISSING_USER = 'missing-user-name'
const MISSING_GROUP = 'missing-group-name'

/**
 * A plain shape rather than the SDK's `Role`: `sameRole` compares the four
 * names, and `UserAndMetadata` cannot be constructed from a test because its
 * constructor's parameter type includes the getter `effectiveRolesAndOrigins`.
 */
interface ExpectedRole {
  readonly name: string
  readonly bucket?: string
  readonly scope?: string
  readonly collection?: string
}

interface ExpectedRoleAndOrigin extends ExpectedRole {
  readonly origins: readonly Origin[]
}

interface ExpectedUser {
  readonly username: string
  readonly displayName?: string
  readonly domain: string
  readonly roles: readonly ExpectedRole[]
  readonly effectiveRoles: readonly ExpectedRoleAndOrigin[]
}

// A created user comes back with more than it was sent: roles gain wildcard
// scope and collection where the server filled them in, and an origin (user or
// group). These derive the expectation from the declaration the upsert used.

function toExpectedRole(
  collectionsSupported: boolean,
  name: string,
  bucket?: string,
  scope?: string,
  collection?: string
): ExpectedRole {
  if (bucket !== undefined && collectionsSupported) {
    // The server reports a bucket-wide role with wildcard scope and collection.
    scope = scope ?? '*'
    collection = collection ?? '*'
  }
  return { name, bucket, scope, collection }
}

function toExpectedRoleFromString(
  collectionsSupported: boolean,
  declared: string
): ExpectedRole {
  const [name, keyspace] = declared.split('[')
  if (keyspace === undefined) {
    return toExpectedRole(collectionsSupported, name)
  }
  const parts = keyspace.replace(']', '').split(':')
  return toExpectedRole(
    collectionsSupported,
    name,
    parts[0],
    parts[1],
    parts[2]
  )
}

function toExpected(
  collectionsSupported: boolean,
  declared: Role | string
): ExpectedRole {
  return typeof declared === 'string'
    ? toExpectedRoleFromString(collectionsSupported, declared)
    : toExpectedRole(
        collectionsSupported,
        declared.name,
        declared.bucket,
        declared.scope,
        declared.collection
      )
}

function toExpectedUserAndMetadata(
  collectionsSupported: boolean,
  user: IUser,
  domain: string = LOCAL,
  groups?: readonly IGroup[]
): ExpectedUser {
  const roles = (user.roles ?? []).map((r) =>
    toExpected(collectionsSupported, r)
  )

  const effectiveRoles: ExpectedRoleAndOrigin[] = roles.map((r) => ({
    ...r,
    origins: [new Origin({ type: 'user' })],
  }))
  for (const group of groups ?? []) {
    for (const r of group.roles ?? []) {
      effectiveRoles.push({
        ...toExpected(collectionsSupported, r),
        origins: [new Origin({ type: 'group', name: group.name })],
      })
    }
  }

  return {
    username: user.username,
    displayName: user.displayName,
    domain,
    roles,
    effectiveRoles,
  }
}

function sameRole(a: Role | ExpectedRole, b: Role | ExpectedRole): boolean {
  return (
    a.name === b.name &&
    a.bucket === b.bucket &&
    a.scope === b.scope &&
    a.collection === b.collection
  )
}

function describeRole(r: Role | ExpectedRole): string {
  return [r.name, r.bucket, r.scope, r.collection]
    .filter((part) => part !== undefined)
    .join('/')
}

/**
 * Roles are matched by identity, not position, since the server promises no
 * order. Each must appear exactly once: a duplicate would otherwise pass both
 * a length check and a membership check.
 */
function assertUserAndMetadata(
  actual: UserAndMetadata,
  expected: ExpectedUser,
  c: AssertCtx
): void {
  expect(actual.username, withCtx('username', c)).toStrictEqual(
    expected.username
  )
  expect(actual.domain, withCtx('domain', c)).toStrictEqual(expected.domain)
  expect(actual.displayName, withCtx('displayName', c)).toStrictEqual(
    expected.displayName
  )
  if (actual.domain === LOCAL) {
    expect(actual.passwordChanged, withCtx('passwordChanged', c)).toBeDefined()
  } else {
    expect(
      actual.passwordChanged,
      withCtx('passwordChanged on an external user', c)
    ).toBeUndefined()
  }

  expect(actual.roles.length, withCtx('role count', c)).toStrictEqual(
    expected.roles.length
  )
  expect(
    actual.effectiveRoles.length,
    withCtx('effective role count', c)
  ).toStrictEqual(expected.effectiveRoles.length)

  for (const role of expected.roles) {
    expect(
      actual.roles.filter((r) => sameRole(r, role)).length,
      withCtx(`role ${describeRole(role)} appears exactly once`, c)
    ).toStrictEqual(1)
  }

  for (const role of expected.effectiveRoles) {
    const matches = actual.effectiveRoles.filter((r) => sameRole(r, role))
    expect(
      matches.length,
      withCtx(`effective role ${describeRole(role)} appears exactly once`, c)
    ).toStrictEqual(1)
    expect(
      matches[0].origins,
      withCtx(`origins of ${describeRole(role)}`, c)
    ).toStrictEqual([...role.origins])
  }
}

/** One name per label for the whole file, so a story's tests share it. */
const runNames = new Map<string, string>()

function runName(env: TestEnv, label: string): string {
  let name = runNames.get(label)
  if (name === undefined) {
    name = `${label}_${env.key()}`
    runNames.set(label, name)
  }
  return name
}

/** Read at call time, so a test's change to the declaration carries over. */
function inRun(env: TestEnv, user: IUser): IUser {
  return {
    ...user,
    username: runName(env, user.username),
    ...(user.groups === undefined
      ? {}
      : { groups: user.groups.map((g) => runName(env, g)) }),
  }
}

function groupInRun(env: TestEnv, group: IGroup): IGroup {
  return { ...group, name: runName(env, group.name) }
}

/** Tolerates a user already gone: usually a test has dropped it. */
function dropUserAfterwards(
  env: TestEnv,
  cluster: Cluster,
  username: string,
  domain: string
): void {
  env.registerCleanup(async () => {
    try {
      await cluster.users().dropUser(username, { domainName: domain })
    } catch (err) {
      if (!(err instanceof UserNotFoundError)) {
        throw err
      }
      return
    }
    await env.consistency.waitUntilUserDropped(username, domain)
  })
}

function dropGroupAfterwards(
  env: TestEnv,
  cluster: Cluster,
  name: string
): void {
  env.registerCleanup(async () => {
    try {
      await cluster.users().dropGroup(name)
    } catch (err) {
      if (!(err instanceof GroupNotFoundError)) {
        throw err
      }
      return
    }
    await env.consistency.waitUntilGroupDropped(name)
  })
}

async function upsertUser(
  env: TestEnv,
  cluster: Cluster,
  user: IUser,
  domain: string = LOCAL
): Promise<void> {
  dropUserAfterwards(env, cluster, user.username, domain)
  await cluster.users().upsertUser(user, { domainName: domain })
  await env.consistency.waitUntilUserPresent(user.username, domain)
}

defineSuite(
  '#usersmgmt',
  { features: [ServerFeature.UserManagement] },
  ({ test, group, lacking }) => {
    const noCollections = lacking(ServerFeature.Collections)
    const collectionsSupported = !noCollections

    describe('#user-roles', () => {
      // `roles` is mutable: one test updates it and the next reads the update
      // back.
      const users: IUser[] = [
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
          username: 'custom-user-4',
          displayName: 'Custom User 4',
          password: 's3cret!',
          roles: ['data_reader[default]', 'data_writer[default]'],
        },
      ]

      // Only a server with collections accepts these roles. Declared
      // everywhere so their tests report as skipped rather than vanish.
      const needsCollections = new Set(['custom-user-2', 'custom-user-3'])
      users.push({
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
      })
      users.push({
        username: 'custom-user-3',
        displayName: 'Custom User 3',
        password: 's3cret!',
        roles: [
          new Role({
            name: 'data_reader',
            bucket: 'default',
            scope: '_default',
            collection: '_default',
          }),
          new Role({
            name: 'data_writer',
            bucket: 'default',
            scope: '_default',
            collection: '_default',
          }),
        ],
      })

      function withoutPassword(user: IUser): IUser {
        const { password: _password, ...rest } = user
        return rest
      }

      for (const user of users) {
        const skip = needsCollections.has(user.username) && noCollections
        const userCtx = (op: string, domain: string): AssertCtx => ({
          op,
          extra: `${domain} user ${user.username}`,
        })

        test.skipIf(skip)(
          `should successfully create local user: ${user.username}`,
          async ({ cluster, env }) => {
            await upsertUser(env, cluster, inRun(env, user))
          }
        )

        test.skipIf(skip)(
          `should successfully create external user: ${user.username}`,
          async ({ cluster, env }) => {
            await upsertUser(
              env,
              cluster,
              withoutPassword(inRun(env, user)),
              EXTERNAL
            )
          }
        )

        test.skipIf(skip)(
          `should successfully get local user: ${user.username}`,
          async ({ cluster, env }) => {
            const created = inRun(env, user)
            const metadata = await cluster.users().getUser(created.username)
            assertUserAndMetadata(
              metadata,
              toExpectedUserAndMetadata(collectionsSupported, created),
              env.ctx(userCtx('getUser', LOCAL))
            )
          }
        )

        test.skipIf(skip)(
          `should successfully get external user: ${user.username}`,
          async ({ cluster, env }) => {
            const created = withoutPassword(inRun(env, user))
            const metadata = await cluster
              .users()
              .getUser(created.username, { domainName: EXTERNAL })
            assertUserAndMetadata(
              metadata,
              toExpectedUserAndMetadata(
                collectionsSupported,
                created,
                EXTERNAL
              ),
              env.ctx(userCtx('getUser', EXTERNAL))
            )
          }
        )

        test.skipIf(skip)(
          'should successfully get all local users',
          async ({ cluster, env }) => {
            const created = inRun(env, user)
            const allUsers = await cluster.users().getAllUsers()
            expect(
              Array.isArray(allUsers),
              withCtx(
                'an array of users',
                env.ctx(userCtx('getAllUsers', LOCAL))
              )
            ).toBe(true)

            const listed = allUsers.filter(
              (u) => u.username === created.username
            )
            expect(
              listed.length,
              withCtx(
                `${created.username} appears exactly once`,
                env.ctx(userCtx('getAllUsers', LOCAL))
              )
            ).toStrictEqual(1)
            assertUserAndMetadata(
              listed[0],
              toExpectedUserAndMetadata(collectionsSupported, created),
              env.ctx(userCtx('getAllUsers', LOCAL))
            )
          }
        )

        test.skipIf(skip)(
          'should successfully get all external users',
          async ({ cluster, env }) => {
            const created = withoutPassword(inRun(env, user))
            const allUsers = await cluster
              .users()
              .getAllUsers({ domainName: EXTERNAL })
            expect(
              Array.isArray(allUsers),
              withCtx(
                'an array of users',
                env.ctx(userCtx('getAllUsers', EXTERNAL))
              )
            ).toBe(true)

            const listed = allUsers.filter(
              (u) => u.username === created.username
            )
            expect(
              listed.length,
              withCtx(
                `${created.username} appears exactly once`,
                env.ctx(userCtx('getAllUsers', EXTERNAL))
              )
            ).toStrictEqual(1)
            assertUserAndMetadata(
              listed[0],
              toExpectedUserAndMetadata(
                collectionsSupported,
                created,
                EXTERNAL
              ),
              env.ctx(userCtx('getAllUsers', EXTERNAL))
            )
          }
        )

        test.skipIf(skip)(
          `should successfully update local user: ${user.username}`,
          async ({ cluster, env }) => {
            // Cluster-wide, so the update changes shape and not only name: the
            // keyspace fields go away with the bucket.
            user.roles = [new Role({ name: 'ro_admin' })]
            const created = inRun(env, user)
            await cluster.users().upsertUser(created)
            await env.consistency.waitUntilUserPresent(created.username)
          }
        )

        test.skipIf(skip)(
          `should successfully get updated local user: ${user.username}`,
          async ({ cluster, env }) => {
            const created = inRun(env, user)
            const metadata = await cluster.users().getUser(created.username)
            assertUserAndMetadata(
              metadata,
              toExpectedUserAndMetadata(collectionsSupported, created),
              env.ctx(userCtx('getUser after update', LOCAL))
            )
          }
        )

        test.skipIf(skip)(
          `should successfully drop local user: ${user.username}`,
          async ({ cluster, env }) => {
            const { username } = inRun(env, user)
            await cluster.users().dropUser(username)
            await env.consistency.waitUntilUserDropped(username)
          }
        )

        test.skipIf(skip)(
          `should successfully drop external user: ${user.username}`,
          async ({ cluster, env }) => {
            const { username } = inRun(env, user)
            await cluster.users().dropUser(username, { domainName: EXTERNAL })
            await env.consistency.waitUntilUserDropped(username, EXTERNAL)
          }
        )
      }
    })

    describe('#usernotfound', () => {
      test('should fail to get a missing user', async ({ cluster, env }) => {
        await expectThrows(
          () => cluster.users().getUser(MISSING_USER),
          UserNotFoundError,
          undefined,
          env.ctx({ op: 'getUser', extra: MISSING_USER })
        )
      })

      test('should fail to drop a missing user', async ({ cluster, env }) => {
        await expectThrows(
          () => cluster.users().dropUser(MISSING_USER),
          UserNotFoundError,
          undefined,
          env.ctx({ op: 'dropUser', extra: MISSING_USER })
        )
      })
    })

    describe('#invalidargument', () => {
      // Never created: every test here is rejected before anything exists.
      const user: IUser = {
        username: 'custom-user-1',
        displayName: 'Custom User 1',
        password: 's3cret!',
        roles: [
          new Role({ name: 'data_reader', bucket: 'default' }),
          new Role({ name: 'data_writer', bucket: 'default' }),
        ],
      }

      test('should fail to upsert external user w/ password', async ({
        cluster,
        env,
      }) => {
        await expectThrows(
          () => cluster.users().upsertUser(user, { domainName: EXTERNAL }),
          InvalidArgumentError,
          undefined,
          env.ctx({ op: 'upsertUser', extra: 'external with a password' })
        )
      })

      test('should fail to upsert user with invalid domain', async ({
        cluster,
        env,
      }) => {
        await expectThrows(
          () =>
            cluster.users().upsertUser(user, { domainName: 'not-a-domain' }),
          InvalidArgumentError,
          undefined,
          env.ctx({ op: 'upsertUser', extra: 'domainName=not-a-domain' })
        )
      })

      test('should fail to get a user with invalid domain', async ({
        cluster,
        env,
      }) => {
        await expectThrows(
          () =>
            cluster
              .users()
              .getUser(user.username, { domainName: 'not-a-domain' }),
          InvalidArgumentError,
          undefined,
          env.ctx({ op: 'getUser', extra: 'domainName=not-a-domain' })
        )
      })

      test('should fail to drop a user with invalid domain', async ({
        cluster,
        env,
      }) => {
        await expectThrows(
          () =>
            cluster
              .users()
              .dropUser(user.username, { domainName: 'not-a-domain' }),
          InvalidArgumentError,
          undefined,
          env.ctx({ op: 'dropUser', extra: 'domainName=not-a-domain' })
        )
      })

      test('should fail to get all users with invalid domain', async ({
        cluster,
        env,
      }) => {
        await expectThrows(
          () => cluster.users().getAllUsers({ domainName: 'not-a-domain' }),
          InvalidArgumentError,
          undefined,
          env.ctx({ op: 'getAllUsers', extra: 'domainName=not-a-domain' })
        )
      })
    })

    describe('#roles', () => {
      test('should successfully get all roles', async ({ cluster, env }) => {
        const roles = await cluster.users().getRoles()
        expect(
          roles.length,
          withCtx('role count', env.ctx({ op: 'getRoles' }))
        ).toBeGreaterThanOrEqual(1)
      })

      test('should fail to upsert user with invalid roles', async ({
        cluster,
        env,
      }) => {
        await expectThrows(
          () =>
            cluster.users().upsertUser(
              {
                username: 'custom-user-1',
                displayName: 'Custom User 1',
                password: 's3cret!',
                roles: [
                  new Role({ name: 'data_reader', bucket: 'not-a-bucket' }),
                ],
              },
              { domainName: EXTERNAL }
            ),
          InvalidArgumentError,
          undefined,
          env.ctx({ op: 'upsertUser', extra: 'role on a missing bucket' })
        )
      })
    })

    group('#user-groups', [ServerFeature.UserGroupManagement], () => {
      const groups: IGroup[] = [
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

      const wildcardRoles: readonly Role[] = [
        new Role({
          name: 'data_reader',
          bucket: '*',
          scope: '*',
          collection: '*',
        }),
        new Role({
          name: 'data_writer',
          bucket: '*',
          scope: '*',
          collection: '*',
        }),
      ]

      const user: IUser = {
        username: 'custom-user-1',
        displayName: 'Custom User 1',
        password: 's3cret!',
        roles: [
          new Role({ name: 'data_reader', bucket: 'default' }),
          new Role({ name: 'data_writer', bucket: 'default' }),
        ],
      }

      for (const declared of groups) {
        test(`should successfully upsert a group: ${declared.name}`, async ({
          cluster,
          env,
        }) => {
          const created = groupInRun(env, declared)
          dropGroupAfterwards(env, cluster, created.name)
          await cluster.users().upsertGroup(created)
          await env.consistency.waitUntilGroupPresent(created.name)
        })

        test(`should successfully get a group: ${declared.name}`, async ({
          cluster,
          env,
        }) => {
          const { name } = groupInRun(env, declared)
          const c = env.ctx({ op: 'getGroup', extra: name })
          const found = await cluster.users().getGroup(name)
          expect(found.name, withCtx('name', c)).toStrictEqual(name)
          expect(found.description, withCtx('description', c)).toStrictEqual(
            declared.description
          )

          if (declared.name === 'test-group-1') {
            expect(found.roles.length, withCtx('role count', c)).toStrictEqual(
              wildcardRoles.length
            )
            if (collectionsSupported) {
              for (const role of wildcardRoles) {
                expect(
                  found.roles.filter((r) => sameRole(r, role)).length,
                  withCtx(`role ${describeRole(role)} appears once`, c)
                ).toStrictEqual(1)
              }
            }
          } else {
            // A cluster-wide role gains no keyspace, so it comes back as
            // declared.
            expect(found.roles, withCtx('roles', c)).toStrictEqual(
              declared.roles
            )
          }
        })
      }

      test('should fail to get a missing group', async ({ cluster, env }) => {
        await expectThrows(
          () => cluster.users().getGroup(MISSING_GROUP),
          GroupNotFoundError,
          undefined,
          env.ctx({ op: 'getGroup', extra: MISSING_GROUP })
        )
      })

      test('should successfully get all groups', async ({ cluster, env }) => {
        const c = env.ctx({ op: 'getAllGroups' })
        const allGroups: Group[] = await cluster.users().getAllGroups()
        expect(
          allGroups.length,
          withCtx('group count', c)
        ).toBeGreaterThanOrEqual(groups.length)
        // One assertion per group rather than a loop, so a failure names the
        // group that is missing.
        const names = allGroups.map((g) => g.name)
        const [first, second] = groups.map((g) => groupInRun(env, g).name)
        expect(names, withCtx(`${first} is listed`, c)).toContain(first)
        expect(names, withCtx(`${second} is listed`, c)).toContain(second)
      })

      test('should successfully upsert user with groups', async ({
        cluster,
        env,
      }) => {
        user.groups = groups.map((g) => g.name)
        await upsertUser(env, cluster, inRun(env, user))
      })

      test('should successfully get user with groups', async ({
        cluster,
        env,
      }) => {
        const created = inRun(env, user)
        const metadata = await cluster.users().getUser(created.username)
        assertUserAndMetadata(
          metadata,
          toExpectedUserAndMetadata(
            collectionsSupported,
            created,
            LOCAL,
            groups.map((g) => groupInRun(env, g))
          ),
          env.ctx({ op: 'getUser', extra: 'with groups' })
        )
        await env.consistency.waitUntilUserPresent(created.username)
      })

      test('should successfully drop user with groups', async ({
        cluster,
        env,
      }) => {
        const { username } = inRun(env, user)
        await cluster.users().dropUser(username)
        await env.consistency.waitUntilUserDropped(username)
      })

      for (const declared of groups) {
        test(`should successfully drop a group: ${declared.name}`, async ({
          cluster,
          env,
        }) => {
          const { name } = groupInRun(env, declared)
          await cluster.users().dropGroup(name)
          await env.consistency.waitUntilGroupDropped(name)
        })
      }

      test('should fail to drop a missing group', async ({ cluster, env }) => {
        await expectThrows(
          () => cluster.users().dropGroup(MISSING_GROUP),
          GroupNotFoundError,
          undefined,
          env.ctx({ op: 'dropGroup', extra: MISSING_GROUP })
        )
      })
    })

    describe('#change-password', () => {
      const label = 'changePasswordUser'
      const startPassword = 'changeUserPassword'
      const newPassword = 'newPassword'

      /**
       * A password change is not effective cluster-wide at once. Only
       * `AuthenticationFailureError` counts as "not yet"; anything else is
       * raised, so a broken connection string does not spin until deadline.
       */
      function connectWhenAccepted(
        env: TestEnv,
        username: string,
        password: string,
        signal: AbortSignal
      ): Promise<Cluster> {
        return pollUntil<Cluster>(
          `the credentials of ${username} to be accepted`,
          async (ctx) => {
            try {
              return await env.openCluster({ username, password })
            } catch (err) {
              if (!(err instanceof AuthenticationFailureError)) {
                throw err
              }
              ctx.note('the password is not in effect yet')
              return undefined
            }
          },
          { deadlineMs: CREDENTIAL_DEADLINE_MS, intervalMs: 100, signal }
        )
      }

      test(
        'should successfully change current user password',
        { retry: OLD_PASSWORD_ATTEMPTS },
        async ({ cluster, env, signal }) => {
          const username = runName(env, label)
          // Set rather than created: on a retry, an earlier attempt may have
          // already changed the password.
          await upsertUser(env, cluster, {
            username,
            password: startPassword,
            roles: ['admin'],
          })

          const asUser = await connectWhenAccepted(
            env,
            username,
            startPassword,
            signal
          )
          await asUser.users().changePassword(newPassword)
          await sleep(PASSWORD_SETTLE_MS, signal)

          const withNewPassword = await connectWhenAccepted(
            env,
            username,
            newPassword,
            signal
          )
          await withNewPassword.close()

          // A connection that opens with the old password is the failure, so
          // it is closed on that branch.
          let rejected = false
          for (let i = 0; i < OLD_PASSWORD_ATTEMPTS; ++i) {
            try {
              const stale = await env.openCluster({
                username,
                password: startPassword,
              })
              await stale.close()
            } catch (err) {
              if (err instanceof AuthenticationFailureError) {
                rejected = true
                break
              }
              throw err
            }
            await sleep(OLD_PASSWORD_DELAY_MS, signal)
          }

          await asUser.close()
          expect(
            rejected,
            withCtx(
              'the old password stopped being accepted',
              env.ctx({ op: 'connect', extra: username })
            )
          ).toBe(true)
        }
      )
    })
  }
)
