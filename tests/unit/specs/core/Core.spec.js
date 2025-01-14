import Murmur from '@icij/murmur'
import { createLocalVue } from '@vue/test-utils'
import axios from 'axios'
import Vue from 'vue'
import VueI18n from 'vue-i18n'
import VueRouter from 'vue-router'
import Vuex from 'vuex'

import Api from '@/api'
import { Core } from '@/core'

jest.mock('axios', () => {
  return {
    get: jest.fn().mockResolvedValue({ data: {} }),
    request: jest.fn().mockResolvedValue({ data: { userProjects: ['first-index'], mode: 'LOCAL' } })
  }
})

describe('Core', () => {
  let localVue

  beforeEach(() => {
    localVue = createLocalVue()
  })

  beforeEach(() => {
    const app = document.createElement('div')
    app.setAttribute('id', 'core')
    document.body.appendChild(app)
    axios.request.mockClear()
  })

  it('should instantiate the Core class', () => {
    const core = new Core(localVue)
    expect(core).toBeInstanceOf(Core)
  })

  it('should instantiate the Core class using a static method', () => {
    const core = Core.init(localVue)
    expect(core).toBeInstanceOf(Core)
  })

  it('should expose the router', () => {
    const { router } = Core.init(localVue).useAll()
    expect(router).toBeInstanceOf(VueRouter)
  })

  it('should expose the VueI18n', () => {
    const { i18n } = Core.init(localVue).useAll()
    expect(i18n).toBeInstanceOf(VueI18n)
  })

  it('should expose the store', () => {
    const { store } = Core.init(localVue).useAll()
    expect(store).toBeInstanceOf(Vuex.Store)
  })

  it('should not expose the router if it is not installed', () => {
    const { router } = Core.init(localVue)
    expect(router).not.toBeInstanceOf(VueRouter)
  })

  it('should not expose the VueI18n if it is not installed', () => {
    const { i18n } = Core.init(localVue)
    expect(i18n).not.toBeInstanceOf(VueI18n)
  })

  it('should expose the config from Murmur', () => {
    const { config } = Core.init(localVue).useAll()
    expect(config).toBe(Murmur.config)
  })

  it('should mount the app on a specific element', () => {
    const core = Core.init(localVue).useAll()
    const vm = core.mount('#core')
    expect(vm).toBeInstanceOf(Vue)
  })

  it('should call a global event "datashare:ready" after the core is configured', done => {
    document.addEventListener('datashare:ready', ({ detail }) => {
      expect(detail.core).toBeInstanceOf(Core)
      done()
    }, { once: true })
    // Create and configure the core
    Core.init(localVue).useAll().configure()
  })

  it('should resolve the `ready` promise after the core was configured', async () => {
    // Create and configure the core
    const core = Core.init(localVue).useAll()
    // For `ready` to be resolved, the core must configure
    await core.configure()
    await expect(core.ready).resolves.toBe(core)
  })

  it('should call isDownloadAllowed API endpoint', async () => {
    const project = 'my-project'
    const core = Core.init(localVue).useAll()
    core.store.commit('search/index', project)
    await core.configure()

    expect(axios.request).toBeCalledTimes(4)
    expect(axios.request).toBeCalledWith(expect.objectContaining({
      url: Api.getFullUrl(`/api/project/isDownloadAllowed/${project}`)
    }))
  })

  it('should install the internal `VueCore` plugin', () => {
    // Create and configure the core
    const core = Core.init(localVue).useAll()
    const vm = core.mount('#core')
    expect(vm.$core).toBeInstanceOf(Core)
  })

  it('should return empty string if user has no projects', () => {
    const core = Core.init(localVue).useAll()
    core.config.set('defaultProject', 'my_project')
    expect(core.getDefaultProject()).toEqual('')
  })

  it('should getDefaultProject when user has it', () => {
    const core = Core.init(localVue).useAll()
    core.config.set('groups_by_applications.datashare', ['my_project'])
    core.config.set('defaultProject', 'my_project')
    expect(core.getDefaultProject()).toEqual('my_project')
  })

  it('should return first user project when user doesn\'t have the default project', () => {
    const core = Core.init(localVue).useAll()
    core.config.set('groups_by_applications.datashare', ['user_project'])
    core.config.set('defaultProject', 'default_project')
    expect(core.getDefaultProject()).toEqual('user_project')
  })
})
