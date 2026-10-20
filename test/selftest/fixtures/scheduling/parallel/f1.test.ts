import { it } from 'vitest'

import { occupy } from '../marker'

it('holds a slot', () => occupy('parallel/f1'), 30_000)
