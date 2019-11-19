import { createLocalVue, mount, shallowMount } from '@vue/test-utils'
import Murmur from '@icij/murmur'
import Vuex from 'vuex'

import { App } from '@/main'
import BatchSearchForm from '@/components/BatchSearchForm'

const { localVue } = App.init(createLocalVue()).useAll()

jest.mock('lodash/throttle', () => jest.fn(fn => fn))

describe('BatchSearchForm.vue', () => {
  let wrapper
  const state = { batchSearches: [] }
  const actions = { onSubmit: jest.fn(), getBatchSearches: jest.fn() }
  const store = new Vuex.Store({ modules: { batchSearch: { namespaced: true, state, actions }, search: { namespaced: true, actions: { queryFacet: jest.fn() } } } })

  beforeAll(() => Murmur.config.merge({ userProjects: [process.env.VUE_APP_ES_INDEX], dataDir: '/root/project' }))

  beforeEach(() => {
    wrapper = shallowMount(BatchSearchForm, { localVue, store, mocks: { $t: msg => msg } })
  })

  afterAll(() => jest.unmock('lodash/throttle'))

  it('should call the store action on form submit and reset the form', async () => {
    jest.spyOn(wrapper.vm, 'resetForm')

    await wrapper.vm.onSubmit()

    expect(actions.onSubmit).toBeCalled()
    expect(wrapper.vm.resetForm).toBeCalled()
  })

  it('should display a form with 7 fields: name, csvFile, description, phraseMatch, fuzziness, fileTypes, paths and published', () => {
    expect(wrapper.findAll('.card-body b-form-group-stub')).toHaveLength(7)
    expect(wrapper.findAll('.card-body b-form-input-stub')).toHaveLength(4)
    expect(wrapper.findAll('.card-body b-form-file-stub')).toHaveLength(1)
    expect(wrapper.findAll('.card-body b-form-textarea-stub')).toHaveLength(1)
    expect(wrapper.findAll('.card-body b-form-checkbox-stub')).toHaveLength(1)
  })

  it('should reset the form', () => {
    wrapper.vm.$set(wrapper.vm, 'name', 'Example')
    wrapper.vm.$set(wrapper.vm, 'csvFile', new File(['File content'], 'test_file.csv', { type: 'text/csv' }))
    wrapper.vm.$set(wrapper.vm, 'description', 'This is a description')
    wrapper.vm.$set(wrapper.vm, 'project', 'project-example')
    wrapper.vm.$set(wrapper.vm, 'phraseMatch', false)
    wrapper.vm.$set(wrapper.vm, 'fuzziness', 2)
    wrapper.vm.$set(wrapper.vm, 'fileType', 'PDF')
    wrapper.vm.$set(wrapper.vm, 'fileTypes', [{ label: 'PDF' }])
    wrapper.vm.$set(wrapper.vm, 'path', 'path test')
    wrapper.vm.$set(wrapper.vm, 'paths', ['This', 'is', 'a', 'multiple', 'paths'])
    wrapper.vm.$set(wrapper.vm, 'published', false)

    wrapper.vm.resetForm()

    expect(wrapper.vm.name).toBe('')
    expect(wrapper.vm.csvFile).toBeNull()
    expect(wrapper.vm.description).toBe('')
    expect(wrapper.vm.project).toBe(process.env.VUE_APP_ES_INDEX)
    expect(wrapper.vm.phraseMatch).toBeTruthy()
    expect(wrapper.vm.fuzziness).toBe(0)
    expect(wrapper.vm.fileType).toBe('')
    expect(wrapper.vm.fileTypes).toEqual([])
    expect(wrapper.vm.path).toBe('')
    expect(wrapper.vm.paths).toEqual([])
    expect(wrapper.vm.published).toBeTruthy()
  })

  it('should reset the fuzziness to 0 on phraseMatch change', () => {
    wrapper.vm.$set(wrapper.vm, 'fuzziness', 12)
    wrapper.vm.$set(wrapper.vm, 'phraseMatch', false)

    expect(wrapper.vm.fuzziness).toBe(0)
  })

  it('should not display "Published" button on local', () => {
    expect(wrapper.find('.card-footer b-form-checkbox-stub').exists()).toBeFalsy()
  })

  it('should display "Published" button on server', () => {
    Murmur.config.merge({ multipleProjects: true })
    wrapper = shallowMount(BatchSearchForm, { localVue, store, mocks: { $t: msg => msg } })

    expect(wrapper.find('.card .published').exists()).toBeTruthy()
  })

  describe('FileTypes suggestions', () => {
    it('should display suggestions', () => {
      expect(wrapper.contains('selectable-dropdown-stub')).toBeTruthy()
    })

    it('should filter fileTypes according to the fileTypes input on mime file', () => {
      wrapper.vm.$set(wrapper.vm, 'fileType', 'visi')

      wrapper.vm.searchFileTypes()

      expect(wrapper.vm.suggestionFileTypes).toHaveLength(2)
      expect(wrapper.vm.suggestionFileTypes[0].label).toBe('Visio document')
      expect(wrapper.vm.suggestionFileTypes[1].label).toBe('StarWriter 5 document')
    })

    it('should filter according to the fileTypes input on label file', () => {
      wrapper.vm.$set(wrapper.vm, 'fileType', 'PDF')

      wrapper.vm.searchFileTypes()

      expect(wrapper.vm.suggestionFileTypes).toHaveLength(1)
      expect(wrapper.vm.suggestionFileTypes[0].label).toBe('Portable Document Format (PDF)')
    })

    it('should hide already selected file type from suggestions', () => {
      wrapper.vm.$set(wrapper.vm, 'fileTypes', [{ mime: 'application/pdf', label: 'Portable Document Format (PDF)' }])
      wrapper.vm.$set(wrapper.vm, 'fileType', 'PDF')

      wrapper.vm.searchFileTypes()

      expect(wrapper.vm.suggestionFileTypes).toHaveLength(0)
    })

    it('should set the clicked item in the fileTypes input', () => {
      wrapper = mount(BatchSearchForm, { localVue, store, mocks: { $t: msg => msg } })
      wrapper.vm.$set(wrapper.vm, 'fileTypes', [{ label: 'Excel 2003 XML spreadsheet visio' }])
      wrapper.vm.searchFileType({ label: 'StarWriter 5 document' })

      expect(wrapper.vm.fileTypes).toEqual([{ label: 'Excel 2003 XML spreadsheet visio' }, { label: 'StarWriter 5 document' }])
    })

    it('should hide suggestions', () => {
      wrapper.vm.$set(wrapper.vm, 'suggestionFileTypes', ['suggestion_01', 'suggestion_02', 'suggestion_03'])

      wrapper.vm.hideSuggestionsFileTypes()

      expect(wrapper.vm.suggestionFileTypes).toEqual([])
    })
  })

  describe('buildTreeFromPaths', () => {
    it('should extract all the first level paths', () => {
      const tree = wrapper.vm.buildTreeFromPaths(['/folder_01/doc_01.txt', '/folder_02/doc_02.txt', '/folder_03/doc_03.txt'])

      expect(tree).toEqual(['folder_01', 'folder_02', 'folder_03'])
    })

    it('should extract all the levels of the path', () => {
      const tree = wrapper.vm.buildTreeFromPaths(['/folder_01/folder_02/folder_03/document.txt'])

      expect(tree).toEqual(['folder_01', 'folder_01/folder_02', 'folder_01/folder_02/folder_03'])
    })

    it('should filter by uniq paths', () => {
      const tree = wrapper.vm.buildTreeFromPaths(['/folder_01/folder_02/document_01.txt', '/folder_01/folder_03/document_02.txt'])

      expect(tree).toEqual(['folder_01', 'folder_01/folder_02', 'folder_01/folder_03'])
    })

    it('should filter off the dataDir', () => {
      const tree = wrapper.vm.buildTreeFromPaths(['/root/project/folder_01/document_01.txt'])

      expect(tree).toEqual(['folder_01'])
    })
  })
})
