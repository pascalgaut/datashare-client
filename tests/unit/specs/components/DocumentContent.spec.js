import { createLocalVue, mount, shallowMount } from '@vue/test-utils'

import Api from '@/api'
import { Core } from '@/core'
import DocumentContent from '@/components/DocumentContent'
import esConnectionHelper from 'tests/unit/specs/utils/esConnectionHelper'
import { IndexedDocument, letData } from 'tests/unit/es_utils'
import { letTextContent } from 'tests/unit/api_mock'
import { flushPromises } from 'tests/unit/tests_utils'

// Disable lodash throttle to avoid side-effets
jest.mock('lodash', () => {
  return {
    ...jest.requireActual('lodash'),
    throttle: cb => cb
  }
})

window.HTMLElement.prototype.scrollIntoView = jest.fn()

describe('DocumentContent.vue', () => {
  const { i18n, localVue, store } = Core.init(createLocalVue()).useAll()
  const { index, es } = esConnectionHelper.build()
  const id = 'document'

  async function mockDocumentContentSlice (content = '', { language = 'ENGLISH' } = {}) {
    const contentSlice = letTextContent()
      .withContent(content)
      .getResponse()
    // Index the document
    await letData(es).have(new IndexedDocument(id, index)
      .withContent(content)
      .withLanguage(language))
      .commit()
    // Mock the `getDocumentSlice` method
    jest.spyOn(Api.prototype, 'getDocumentSlice')
      .mockImplementation(async (project, documentId, offset, limit) => {
        // Modify the returned content according to passed parameters
        const content = contentSlice.content.substring(offset, offset + limit)
        return { ...contentSlice, content, offset, limit }
      })
    // Get the document from the store
    await store.dispatch('document/get', { id, index })
    const document = store.state.document.doc
    // Finally flush all promises and return all necessary values
    flushPromises()
    return { content, contentSlice, document }
  }

  afterEach(async () => {
    // Ensure all promise are flushed...
    await flushPromises()
    // Then clear all mocks
    jest.clearAllMocks()
    // Remove document
    store.commit('document/reset')
  })

  describe('the extracted text content', () => {
    it('should sanitize the HTML in the extracted text', async () => {
      const content = 'this is a <span>content</span> with some <img src="this.is.a.source" alt="alt" title="title" />images and <a href="this.is.an.href" target="_blank">links</a>'
      const { document } = await mockDocumentContentSlice(content)
      const propsData = { document }
      const wrapper = shallowMount(DocumentContent, { i18n, localVue, store, propsData })
      await flushPromises()
      await wrapper.vm.loadContentSlice()
      await wrapper.vm.cookAllContentSlices()
      expect(wrapper.vm.getContentSlice().cookedContent).toEqual('<p>this is a content with some images and links</p>')
    })

    it('should not sanitize the <mark /> tags in the extracted text', async () => {
      const content = 'this is a <mark>document</mark>'
      const { document } = await mockDocumentContentSlice(content)
      const propsData = { document }
      const wrapper = shallowMount(DocumentContent, { i18n, localVue, store, propsData })
      await flushPromises()
      await wrapper.vm.loadContentSlice()
      await wrapper.vm.cookAllContentSlices()
      expect(wrapper.vm.getContentSlice().cookedContent).toEqual('<p>this is a <mark>document</mark></p>')
    })

    it('should display the text right to left for arabic', async () => {
      const content = 'المنال ويتلذذ بالآلام، الألم هو الألم ولكن نتيجة لظروف ما قد تكمن السعاده فيما نتحمله من كد وأسي.'
      const { document } = await mockDocumentContentSlice(content, { language: 'ARABIC' })
      const propsData = { document }
      const wrapper = shallowMount(DocumentContent, { i18n, localVue, store, propsData })
      await flushPromises()
      await wrapper.vm.loadContentSlice()
      expect(wrapper.find('.document-content__body--rtl').exists()).toBeTruthy()
    })

    it('should NOT display the text right to left for english', async () => {
      const { document } = await mockDocumentContentSlice('foo')
      const propsData = { document }
      const wrapper = shallowMount(DocumentContent, { i18n, localVue, store, propsData })
      await flushPromises()
      await wrapper.vm.loadContentSlice()
      expect(wrapper.find('.document-content__body--rtl').exists()).toBeFalsy()
    })
  })

  describe('search term', () => {
    describe('witg 1 occurence', () => {
      beforeEach(() => {
        jest.spyOn(Api.prototype, 'searchDocument')
          .mockImplementation(() => {
            return Promise.resolve({ count: 1, offsets: [10] })
          })
      })

      it('should support regex', async () => {
        const content = 'this is a test.\nFor testing purpose.'
        const { document } = await mockDocumentContentSlice(content)
        const propsData = { document }
        const wrapper = shallowMount(DocumentContent, { i18n, localVue, store, propsData })
        wrapper.vm.$set(wrapper.vm, 'localSearchTerm', { label: 'test.*', regex: true })
        await flushPromises()
        expect(wrapper.vm.localSearchOccurrences).toEqual(1)
      })

      it('should not sticky the toolbox by default', async () => {
        const { document } = await mockDocumentContentSlice('')
        const propsData = { document }
        const wrapper = shallowMount(DocumentContent, { i18n, localVue, store, propsData })
        await flushPromises()
        expect(wrapper.find('.document-content__toolbox--sticky').exists()).toBeFalsy()
      })
    })

    describe('with 2 occurences', () => {
      let wrapper

      beforeEach(async () => {
        const content = 'this is a full full content'
        const { document } = await mockDocumentContentSlice(content)
        jest.spyOn(Api.prototype, 'searchDocument')
          .mockImplementation(async () => {
            return { count: 2, offsets: [10, 15] }
          })
        const propsData = { document }
        wrapper = mount(DocumentContent, { i18n, localVue, store, propsData })
        await flushPromises()
        await wrapper.vm.loadContentSlice()
        // Use vm.$set method to set nested value reactivly
        wrapper.vm.$set(wrapper.vm, 'localSearchTerm', { label: 'full' })
        await flushPromises()
      })

      it('should sticky the toolbox by default', () => {
        expect(wrapper.find('.document-content__toolbox--sticky').exists()).toBeTruthy()
      })

      it('should highlight the first occurrence of the searched term', async () => {
        const { innerHTML } = wrapper.find('.document-content__body .document-content-slice').element
        expect(wrapper.vm.localSearchIndex).toEqual(1)
        expect(innerHTML).toEqual('<p>this is a <mark class="local-search-term local-search-term--active" data-offset="10">full</mark> <mark class="local-search-term" data-offset="15">full</mark> content</p>')
      })

      it('should find the previous and next occurrence, as a loop', async () => {
        const { element } = wrapper.find('.document-content__body  .document-content-slice')

        expect(wrapper.vm.localSearchIndex).toEqual(1)
        expect(element.innerHTML).toEqual('<p>this is a <mark class="local-search-term local-search-term--active" data-offset="10">full</mark> <mark class="local-search-term" data-offset="15">full</mark> content</p>')

        wrapper.vm.findNextLocalSearchTerm()
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.localSearchIndex).toEqual(2)
        expect(element.innerHTML).toEqual('<p>this is a <mark class="local-search-term" data-offset="10">full</mark> <mark class="local-search-term local-search-term--active" data-offset="15">full</mark> content</p>')

        wrapper.vm.findPreviousLocalSearchTerm()
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.localSearchIndex).toEqual(1)
        expect(element.innerHTML).toEqual('<p>this is a <mark class="local-search-term local-search-term--active" data-offset="10">full</mark> <mark class="local-search-term" data-offset="15">full</mark> content</p>')

        wrapper.vm.findNextLocalSearchTerm()
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.localSearchIndex).toEqual(2)
        expect(element.innerHTML).toEqual('<p>this is a <mark class="local-search-term" data-offset="10">full</mark> <mark class="local-search-term local-search-term--active" data-offset="15">full</mark> content</p>')
      })
    })

    describe('with 3 occurences', () => {
      let wrapper

      beforeEach(async () => {
        const content = 'this is a full FulL content fuLL'
        const { document } = await mockDocumentContentSlice(content)
        jest.spyOn(Api.prototype, 'searchDocument')
          .mockImplementation(async () => {
            return { count: 3, offsets: [10, 15, 28] }
          })
        const propsData = { document }
        wrapper = mount(DocumentContent, { i18n, localVue, store, propsData })
        await flushPromises()
        await wrapper.vm.loadContentSlice()
      })

      it('should be case insensitive', async () => {
        // Use vm.$set method to set nested value reactivly
        wrapper.vm.$set(wrapper.vm, 'localSearchTerm', { label: 'full' })
        await flushPromises()
        expect(wrapper.vm.localSearchOccurrences).toEqual(3)
      })
    })
  })

  describe('document content lazy loading', () => {
    it('should lazy load the entire document', async () => {
      // Create a document with a small content text length
      const content = 'this is a content'
      const { document } = await mockDocumentContentSlice(content)
      const propsData = { document }
      const wrapper = mount(DocumentContent, { i18n, localVue, store, propsData })
      await flushPromises()
      await wrapper.vm.loadContentSlice()
      expect(wrapper.vm.getContentSlice().content).toBe('this is a content')
    })

    it('should lazy load 2 slices of 10 caracters of a long text document', async () => {
      // Create a document with a small content text length
      const content = 'this is a content from Elastic Search doc which looks huge'
      const { document } = await mockDocumentContentSlice(content)
      const pageSize = 10
      const propsData = { document, pageSize }
      const wrapper = mount(DocumentContent, { i18n, localVue, store, propsData })
      await flushPromises()
      // Load the first slice
      await wrapper.vm.loadContentSlice({ offset: 0 })
      expect(wrapper.vm.getContentSlice({ offset: 0 }).content).toBe('this is a ')
      // Continue to load content
      await wrapper.vm.loadContentSlice({ offset: 10 })
      expect(wrapper.vm.getContentSlice({ offset: 10 }).content).toBe('content fr')
    })
  })

  describe('an organic extracted text content', () => {
    it('should lazy load 2 slices and merge them', async () => {
      // Create a document with a small content text length
      const content = 'this is a content from Elastic Search doc which looks huge'
      const { document } = await mockDocumentContentSlice(content)
      const pageSize = 30
      const propsData = { document, pageSize }
      const wrapper = mount(DocumentContent, { i18n, localVue, store, propsData })
      await flushPromises()
      // Load two slices
      await wrapper.vm.loadContentSlice({ offset: 0 })
      await wrapper.vm.loadContentSlice({ offset: 30 })
      // Cook all slices
      await wrapper.vm.cookAllContentSlices()
      expect(wrapper.vm.getContentSlice({ offset: 0 }).cookedContent).toBe('<p>this is a content from Elastic Search doc which looks huge</p>')
    })

    describe('with 1 occurences', () => {
      beforeEach(async () => {
        jest.spyOn(Api.prototype, 'searchDocument')
          .mockImplementation(async () => {
            return { count: 1, offsets: [37] }
          })
      })

      it('should lazy load 2 slices and merge them with the correct search mark', async () => {
        // Create a document with a small content text length
        const content = 'this is a content and content can be long'
        const { document } = await mockDocumentContentSlice(content)
        const pageSize = 25
        const propsData = { document, pageSize }
        const wrapper = mount(DocumentContent, { i18n, localVue, store, propsData })
        wrapper.vm.$set(wrapper.vm, 'localSearchTerm', { label: 'long' })
        await flushPromises()
        // Load two slices
        await wrapper.vm.loadContentSlice({ offset: 0 })
        await wrapper.vm.loadContentSlice({ offset: 25 })
        // Cook all slices
        await wrapper.vm.cookAllContentSlices()
        expect(wrapper.vm.getContentSlice({ offset: 0 }).cookedContent).toBe('<p>this is a content and content can be <mark class="local-search-term" data-offset="37">long</mark></p>')
      })
    })

    describe('with 2 occurences', () => {
      beforeEach(async () => {
        jest.spyOn(Api.prototype, 'searchDocument')
          .mockImplementation(async () => {
            return { count: 2, offsets: [8, 29] }
          })
      })

      it('should lazy load 2 slices and merge them with the correct search marks', async () => {
        // Create a document with a small content text length
        const content = 'ICIJ: stories that rock the world'
        const { document } = await mockDocumentContentSlice(content)
        const pageSize = 25
        const propsData = { document, pageSize }
        const wrapper = mount(DocumentContent, { i18n, localVue, store, propsData })
        wrapper.vm.$set(wrapper.vm, 'localSearchTerm', { label: 'or' })
        await flushPromises()
        // Load two slices
        await wrapper.vm.loadContentSlice({ offset: 0 })
        await wrapper.vm.loadContentSlice({ offset: 25 })
        // Cook all slices
        await wrapper.vm.cookAllContentSlices()
        expect(wrapper.vm.getContentSlice({ offset: 0 }).cookedContent).toBe('<p>ICIJ: st<mark class="local-search-term" data-offset="8">or</mark>ies that rock the w<mark class="local-search-term" data-offset="29">or</mark>ld</p>')
      })
    })

    it('should lazy load 3 slices and only merge the two last', async () => {
      // Create a document with a small content text length
      const content = 'lorem ipsum\ndolor sit amet'
      const { document } = await mockDocumentContentSlice(content)
      const pageSize = 11
      const propsData = { document, pageSize }
      const wrapper = mount(DocumentContent, { i18n, localVue, store, propsData })
      await flushPromises()
      // Load the first slice
      // Load two slices
      await wrapper.vm.loadContentSlice({ offset: 0 })
      await wrapper.vm.loadContentSlice({ offset: 11 })
      await wrapper.vm.loadContentSlice({ offset: 22 })
      // Cook all slices
      await wrapper.vm.cookAllContentSlices()
      expect(wrapper.vm.getContentSlice({ offset: 0 }).cookedContent).toBe('<p>lorem ipsum</p>')
      expect(wrapper.vm.getContentSlice({ offset: 11 }).cookedContent).toBe('<p>dolor sit amet</p>')
    })
  })
})
