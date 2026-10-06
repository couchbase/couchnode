import { it } from 'vitest'

import { occupy } from '../marker'

it('holds a slot', () => occupy('sequential/f1'), 30_000)
