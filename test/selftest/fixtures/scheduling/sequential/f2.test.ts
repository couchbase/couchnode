import { it } from 'vitest'

import { occupy } from '../marker'

it('holds a slot', () => occupy('sequential/f2'), 30_000)
