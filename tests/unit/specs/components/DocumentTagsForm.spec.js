import VueI18n from 'vue-i18n'
import { createServer } from 'http-server'
import Murmur from '@icij/murmur'
import { createLocalVue, shallowMount } from '@vue/test-utils'
import { IndexedDocument, letData } from 'tests/unit/es_utils'
import esConnectionHelper from 'tests/unit/specs/utils/esConnectionHelper'
import DocumentTagsForm from '@/components/DocumentTagsForm'
import messages from '@/lang/en'
import store from '@/store'
import '@/utils/font-awesome'
import { datashare } from '@/store/modules/document'
import { jsonOk } from 'tests/unit/tests_utils'
import { BForm, BFormInput } from 'bootstrap-vue'
import DatashareClient from '@/api/DatashareClient'
import esClient from '@/api/esClient'

const localVue = createLocalVue()
localVue.use(VueI18n)
localVue.use(Murmur)
localVue.component('b-form', BForm)
localVue.component('b-form-input', BFormInput)
const i18n = new VueI18n({ locale: 'en', messages: { 'en': messages } })

describe('DocumentTagsForm.vue', () => {
  esConnectionHelper()
  const es = esConnectionHelper.es
  let httpServer, spy

  beforeAll(() => {
    httpServer = createServer({ root: 'tests/unit/resources' })
    httpServer.listen(9876)
    store.commit('search/index', process.env.VUE_APP_ES_INDEX)
  })

  beforeEach(() => {
    jest.spyOn(datashare, 'fetch')
    spy = jest.spyOn(esClient, 'getEsDoc')
    datashare.fetch.mockReturnValue(jsonOk())
  })

  afterEach(() => {
    store.commit('document/reset')
    datashare.fetch.mockRestore()
  })

  afterAll(() => httpServer.close())

  it('should display tags, with delete button', async () => {
    const id = 'document'
    await letData(es).have(new IndexedDocument(id).withTags(['tag_01', 'tag_02'])).commit()
    await store.dispatch('document/get', { id })
    const wrapper = shallowMount(DocumentTagsForm, { localVue, i18n, propsData: { document: store.state.document.doc } })

    expect(wrapper.findAll('.document-tags-form__tag')).toHaveLength(2)
    expect(wrapper.findAll('.document-tags-form__tag__delete')).toHaveLength(2)
  })

  it('should call API endpoint to add a tag and then reload the document from ES', async () => {
    const id = 'document'
    await letData(es).have(new IndexedDocument(id).withTags(['tag_01'])).commit()
    await store.dispatch('document/get', { id })
    const wrapper = shallowMount(DocumentTagsForm, { localVue, i18n, store, propsData: { document: store.state.document.doc } })

    spy.mockClear()
    wrapper.vm.tag = 'tag_02'
    await wrapper.vm.addTag()

    expect(datashare.fetch).toHaveBeenCalledTimes(1)
    expect(datashare.fetch).toBeCalledWith(DatashareClient.getFullUrl(`/api/document/project/tag/${process.env.VUE_APP_ES_INDEX}/${id}?routing=${id}`),
      { method: 'PUT', body: JSON.stringify(['tag_02']) })
    expect(esClient.getEsDoc).toHaveBeenCalledTimes(1)
  })

  it('should call API endpoint to remove a tag and then reload the document from ES', async () => {
    const id = 'document'
    await letData(es).have(new IndexedDocument(id).withTags(['tag_01', 'tag_02'])).commit()
    await store.dispatch('document/get', { id })
    const wrapper = shallowMount(DocumentTagsForm, { localVue, i18n, store, propsData: { document: store.state.document.doc } })

    spy.mockClear()
    await wrapper.vm.deleteTag('tag_01')

    expect(datashare.fetch).toHaveBeenCalledTimes(1)
    expect(datashare.fetch).toBeCalledWith(DatashareClient.getFullUrl(`/api/document/project/untag/${process.env.VUE_APP_ES_INDEX}/${id}?routing=${id}`),
      { method: 'PUT', body: JSON.stringify(['tag_01']) })
    expect(esClient.getEsDoc).toHaveBeenCalledTimes(1)
  })

  it('should display form to add new tag', async () => {
    const id = 'document'
    await letData(es).have(new IndexedDocument(id)).commit()
    await store.dispatch('document/get', { id })
    const wrapper = shallowMount(DocumentTagsForm, { localVue, i18n, store, propsData: { document: store.state.document.doc } })

    expect(wrapper.findAll('.document-tags-form__add')).toHaveLength(1)
  })
})