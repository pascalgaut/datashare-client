import find from 'lodash/find'
import toLower from 'lodash/toLower'
import Murmur from '@icij/murmur'
import { createLocalVue, shallowMount } from '@vue/test-utils'
import axios from 'axios'
import VueRouter from 'vue-router'

import Api from '@/api'
import FilterProject from '@/components/filter/types/FilterProject'
import { Core } from '@/core'
import esConnectionHelper from 'tests/unit/specs/utils/esConnectionHelper'

jest.mock('axios', () => {
  return {
    request: jest.fn().mockResolvedValue({ data: [] })
  }
})

describe('FilterProject.vue', () => {
  const { i18n, localVue, store, wait } = Core.init(createLocalVue()).useAll()
  localVue.mixin({ created () {} })
  const mergeCreatedStrategy = localVue.config.optionMergeStrategies.created
  localVue.config.optionMergeStrategies.created = (parent, _) => mergeCreatedStrategy(parent)
  const project = toLower('FilterProject')
  const anotherProject = toLower('AnotherFilterProject')
  esConnectionHelper([project, anotherProject])
  let wrapper = null

  beforeAll(() => {
    Murmur.config.merge({ groups_by_applications: { datashare: JSON.stringify([project, anotherProject]) } })
    store.commit('search/index', project)
  })

  beforeEach(() => {
    wrapper = shallowMount(FilterProject, { i18n, localVue, store, wait, propsData: { filter: find(store.getters['search/instantiatedFilters'], { name: 'language' }) } })
  })

  afterAll(() => jest.unmock('axios'))

  it('should not display a dropdown if we aren\'t in server mode', () => {
    wrapper = shallowMount(FilterProject, { i18n, localVue, store, wait, propsData: { filter: find(store.getters['search/instantiatedFilters'], { name: 'language' }) } })

    expect(wrapper.findAll('option')).toHaveLength(0)
  })

  it('should select the local project as default selected project', () => {
    expect(wrapper.vm.selectedProject).toEqual([project])
  })

  describe('on project change', () => {
    beforeEach(() => {
      wrapper = shallowMount(FilterProject, { i18n, localVue, store, router: new VueRouter(), wait, propsData: { filter: find(store.getters['search/instantiatedFilters'], { name: 'language' }) } })
      store.commit('downloads/clear')
    })

    afterEach(() => axios.request.mockClear())

    it('should reset search state', async () => {
      store.commit('search/addFilterValue', { name: 'contentType', value: 'text/javascript' })
      expect(store.getters['search/toRouteQuery']()['f[contentType]']).not.toBeUndefined()

      await wrapper.vm.select(anotherProject)

      expect(store.getters['search/toRouteQuery']().index).toBe(anotherProject)
      expect(store.getters['search/toRouteQuery']()['f[contentType]']).toBeUndefined()
    })

    it('should emit an event "filter::search::reset-filters"', async () => {
      const mockCallback = jest.fn()
      wrapper.vm.$root.$on('filter::search::reset-filters', mockCallback)

      mockCallback.mockClear()

      await wrapper.vm.select(anotherProject)

      expect(mockCallback.mock.calls).toHaveLength(1)
    })

    it('should refresh the starred documents', async () => {
      await wrapper.vm.select(anotherProject)

      expect(axios.request).toBeCalledTimes(3)
      expect(axios.request).toBeCalledWith({ url: Api.getFullUrl(`/api/${anotherProject}/documents/starred`) })
    })

    it('should refresh the download store', async () => {
      await wrapper.vm.select(anotherProject)

      expect(axios.request).toBeCalledTimes(3)
      expect(axios.request).toBeCalledWith(expect.objectContaining({
        url: Api.getFullUrl(`/api/project/isDownloadAllowed/${anotherProject}`)
      }))
    })

    it('should refresh the recommendedByUsers', async () => {
      await wrapper.vm.select(anotherProject)

      expect(axios.request).toBeCalledTimes(3)
      expect(axios.request).toBeCalledWith(expect.objectContaining({
        url: Api.getFullUrl('/api/users/recommendations'),
        method: 'GET',
        params: {
          project: anotherProject
        }
      }))
    })

    it('should refresh the route', async () => {
      const spyRefreshRoute = jest.spyOn(wrapper.vm, 'refreshRoute')
      expect(spyRefreshRoute).not.toBeCalled()

      await wrapper.vm.select(anotherProject)

      expect(spyRefreshRoute).toBeCalledTimes(1)
      expect(store.getters['search/toRouteQuery']().index).toBe(anotherProject)
    })
  })
})
