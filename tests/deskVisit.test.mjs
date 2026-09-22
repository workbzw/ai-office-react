import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server
let initialAgents
let startDeskVisit
let startReturnToDesk
let simulator
let movement

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    resolve: {
      alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
    },
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  const layout = await server.ssrLoadModule('/src/scene/layout/officeLayout.ts')
  const visits = await server.ssrLoadModule('/src/scene/simulation/deskVisit.ts')
  const { OfficeSimulator } = await server.ssrLoadModule('/src/scene/simulation/OfficeSimulator.ts')
  const { MovementSystem } = await server.ssrLoadModule('/src/scene/systems/MovementSystem.ts')
  initialAgents = layout.INITIAL_AGENTS
  startDeskVisit = visits.startDeskVisit
  startReturnToDesk = visits.startReturnToDesk
  simulator = new OfficeSimulator()
  movement = new MovementSystem()
})

after(async () => {
  await server?.close()
})

// Keep the scene's frame order; only replace the rendering entities.
function tick(agents) {
  const dt = 1 / 60
  const entities = new Map(simulator.tick(dt, agents).map(agent => [agent.id, {
    data: agent,
    apply(patch) { this.data = { ...this.data, ...patch } },
    setPosition(x, y) { this.data.x = x; this.data.y = y },
    showBubble() {},
    hideBubble() {},
  }]))
  movement.update(entities, dt)
  return simulator.afterMovement(dt, [...entities.values()].map(entity => entity.data), entities)
}

function advance(agents, frames) {
  for (let frame = 0; frame < frames; frame++) agents = tick(agents)
  return agents
}

function startVisit(customAnimation) {
  const agents = structuredClone(initialAgents)
  if (customAnimation) {
    agents[0] = { ...agents[0], state: 'talking', viewFacing: 'front', customAnimation }
  }
  return advance(startDeskVisit(agents, 1, 3, 'test'), 120)
}

function finishReturn(agents) {
  for (let frame = 0; frame < 1800 && agents[0].mission; frame++) agents = tick(agents)
  assert.equal(agents[0].mission, undefined, 'return should finish within 30 seconds')
  return advance(agents, 2)
}

function assertAtHome(agent) {
  assert.equal(agent.x, initialAgents[0].x)
  assert.equal(agent.y, initialAgents[0].y)
  assert.equal(agent.targetX, undefined)
  assert.equal(agent.targetY, undefined)
  assert.equal(agent.walkPath, undefined)
}

for (const state of ['working', 'thinking', 'idle']) {
  test(`return applies ${state} instead of the previous expression`, () => {
    let agents = startVisit('emotes/laugh')
    const position = { x: agents[0].x, y: agents[0].y }
    agents = startReturnToDesk(agents, agents[0].id, { landingState: state, task: 'new task' })
    assert.equal(agents[0].x, position.x)
    assert.equal(agents[0].y, position.y)
    agents = finishReturn(agents)
    assertAtHome(agents[0])
    assert.equal(agents[0].customAnimation, undefined)
    assert.equal(agents[0].state, state)
    assert.equal(agents[0].currentTask, state === 'idle' ? undefined : 'new task')
  })
}

test('state updates every second do not restart the return route', () => {
  let agents = startVisit()
  for (let frame = 0; frame < 1800; frame++) {
    if (frame % 60 === 0) {
      agents = startReturnToDesk(agents, agents[0].id, { landingState: 'working' })
    }
    agents = tick(agents)
  }
  assert.equal(agents[0].mission, undefined)
  assertAtHome(agents[0])
  assert.equal(agents[0].state, 'working')
})

test('updates preserve a normal visit return route and replace its landing action', () => {
  let agents = startVisit('emotes/laugh')
  for (let frame = 0; frame < 1800 && agents[0].mission?.phase !== 'return'; frame++) {
    agents = tick(agents)
  }
  assert.equal(agents[0].mission?.phase, 'return')
  agents = advance(agents, 10)
  const returning = agents[0]
  for (const options of [
    { landingAnimation: 'emotes/wave', task: 'wave' },
    { landingState: 'thinking', task: 'think' },
    { landingAnimation: 'emotes/idea', task: 'idea' },
  ]) {
    agents = startReturnToDesk(agents, returning.id, options)
    assert.equal(agents[0].walkPath, returning.walkPath)
    assert.equal(agents[0].walkPathIndex, returning.walkPathIndex)
    assert.equal(agents[0].targetX, returning.targetX)
    assert.equal(agents[0].targetY, returning.targetY)
    assert.equal(agents[0].x, returning.x)
    assert.equal(agents[0].y, returning.y)
    assert.equal(agents[0].customAnimation, undefined)
    assert.equal(agents[0].mission.landingState, options.landingState)
    assert.equal(agents[0].mission.landingAnimation, options.landingAnimation)
  }
  agents = finishReturn(agents)
  assertAtHome(agents[0])
  assert.equal(agents[0].state, 'talking')
  assert.equal(agents[0].customAnimation, 'emotes/idea')
  assert.equal(agents[0].viewFacing, 'front')
  assert.equal(agents[0].currentTask, 'idea')
})

test('a state request supersedes an expression queued for arrival', () => {
  let agents = startVisit()
  agents = startReturnToDesk(agents, agents[0].id, { landingAnimation: 'emotes/wave' })
  agents = advance(agents, 10)
  agents = startReturnToDesk(agents, agents[0].id, { landingState: 'idle' })
  agents = finishReturn(agents)
  assertAtHome(agents[0])
  assert.equal(agents[0].state, 'idle')
  assert.equal(agents[0].customAnimation, undefined)
})

test('an uninterrupted visit still returns to work', () => {
  const agents = finishReturn(startVisit())
  assertAtHome(agents[0])
  assert.equal(agents[0].state, 'working')
})

test('unknown and already seated agents are unchanged', () => {
  const agents = structuredClone(initialAgents)
  assert.equal(startReturnToDesk(agents, 'unknown', { landingState: 'idle' }), agents)
  assert.equal(startReturnToDesk(agents, agents[0].id, { landingState: 'idle' }), agents)
})
