import Vuex from 'vuex'
import VueI18n from 'vue-i18n'
import BootstrapVue from 'bootstrap-vue'
import Murmur from '@icij/murmur'
import { createLocalVue, mount } from '@vue/test-utils'
import { createServer } from 'http-server'
import { IndexedDocument, letData } from 'tests/unit/es_utils'
import esConnectionHelper from 'tests/unit/specs/utils/esConnectionHelper'
import messages from '@/lang/en'
import router from '@/router'
import store from '@/store'
import DocumentView from '@/components/document/DocumentView'

const localVue = createLocalVue()
localVue.use(Vuex)
localVue.use(VueI18n)
localVue.use(Murmur)
localVue.use(BootstrapVue)
const i18n = new VueI18n({ locale: 'en', messages: { 'en': messages } })

describe('DocumentView.vue', () => {
  esConnectionHelper()
  const es = esConnectionHelper.es
  let httpServer

  beforeAll(() => {
    httpServer = createServer({ root: 'tests/unit/resources' })
    httpServer.listen(9876)
    store.commit('search/index', process.env.VUE_APP_ES_INDEX)
  })

  afterEach(() => {
    store.commit('document/reset')
    Murmur.config.merge({ dataDir: null, mountedDataDir: null })
  })

  afterAll(() => httpServer.close())

  it('should display an error message if document is not found', async () => {
    const id = 'notfound'
    const wrapper = mount(DocumentView, { localVue, i18n, store, router, propsData: { id } })

    await wrapper.vm.getDoc()

    expect(wrapper.find('span').text()).toEqual('Document not found')
  })

  it('should display a document', async () => {
    Murmur.config.merge({ dataDir: null, mountedDataDir: null })
    const id = 'foo.txt'
    const wrapper = mount(DocumentView, { localVue, i18n, store, router, propsData: { id } })

    await letData(es).have(new IndexedDocument(id)
      .withContent('this is foo document'))
      .commit()
    await wrapper.vm.getDoc()

    expect(wrapper.contains('.document__header')).toBeTruthy()
  })

  it('should call the SpreadsheetViewer component for XLSX document', async () => {
    const id = 'spreadsheet.xlsx'
    const wrapper = mount(DocumentView, { localVue, i18n, store, router, propsData: { id } })

    await letData(es).have(new IndexedDocument(id)
      .withContent('')
      .withContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
      .commit()

    await wrapper.vm.getDoc()
    wrapper.vm.tab = 'preview'

    expect(wrapper.contains('.spreadsheet-viewer')).toBeTruthy()
  })

  it('should call the SpreadsheetViewer component for CSV document', async () => {
    const id = 'spreadsheet.csv'
    const wrapper = mount(DocumentView, { localVue, i18n, store, router, propsData: { id } })

    await letData(es).have(new IndexedDocument(id)
      .withContent('')
      .withContentType('text/csv'))
      .commit()

    await wrapper.vm.getDoc()
    wrapper.vm.tab = 'preview'

    expect(wrapper.contains('.spreadsheet-viewer')).toBeTruthy()
  })

  it('should call the PdfViewer component for PDF document', async () => {
    const id = 'document.pdf'
    const wrapper = mount(DocumentView, { localVue, i18n, router, store, propsData: { id } })

    await letData(es).have(new IndexedDocument(id)
      .withContent('')
      .withContentType('application/pdf'))
      .commit()

    wrapper.vm.tab = 'preview'
    await wrapper.vm.getDoc()

    expect(wrapper.contains('.pdf-viewer')).toBeTruthy()
  })

  it('should call the TiffViewer component for TIFF document', async () => {
    const id = 'image.tiff'
    const wrapper = mount(DocumentView, { localVue, i18n, router, store, propsData: { id } })

    await letData(es).have(new IndexedDocument(id)
      .withContent('')
      .withContentType('image/tiff'))
      .commit()

    await wrapper.vm.getDoc()
    wrapper.vm.tab = 'preview'

    expect(wrapper.contains('.tiff-viewer')).toBeTruthy()
  })

  it('should display the named entities tab in LOCAL mode', async () => {
    const id = 'doc.txt'
    Murmur.config.merge({ dataDir: null, mountedDataDir: null })
    const wrapper = mount(DocumentView, { localVue, i18n, store, router, propsData: { id } })

    await letData(es).have(new IndexedDocument(id)
      .withContent('this is foo document'))
      .commit()
    await wrapper.vm.getDoc()

    expect(wrapper.findAll('.document .document__header__nav__item')).toHaveLength(4)
    expect(wrapper.findAll('.document .document__header__nav__item').at(1).text()).toContain('Named Entities')
  })

  it('should NOT display the named entities tab in SERVER mode', async () => {
    const id = 'doc.txt'
    Murmur.config.merge({ mode: 'SERVER' })
    const wrapper = mount(DocumentView, { localVue, i18n, store, router, propsData: { id } })

    await letData(es).have(new IndexedDocument(id)
      .withContent('this is foo document'))
      .commit()
    await wrapper.vm.getDoc()

    expect(wrapper.findAll('.document .document__header__nav__item')).toHaveLength(3)
    expect(wrapper.findAll('.document .document__header__nav__item').at(1).text()).not.toContain('Named Entities')
  })

  it('should contains a "See highlights" toggle in the document header', async () => {
    const id = 'doc.txt'
    const wrapper = mount(DocumentView, { localVue, i18n, router, store, propsData: { id } })

    await letData(es).have(new IndexedDocument(id)
      .withContent('this is foo document'))
      .commit()
    await wrapper.vm.getDoc()

    expect(wrapper.findAll('.document .document__header .document__header__see-highlights')).toHaveLength(1)
  })

  it('should change the document state of showNamedEntities', async () => {
    const id = 'doc.txt'
    const wrapper = mount(DocumentView, { localVue, i18n, router, store, propsData: { id } })

    await letData(es).have(new IndexedDocument(id)
      .withContent('this is foo document'))
      .commit()
    await wrapper.vm.getDoc()
    expect(wrapper.vm.showNamedEntities).toBeTruthy()

    wrapper.findAll('.document .document__header .document__header__see-highlights').at(0).trigger('click')

    expect(wrapper.vm.showNamedEntities).toBeFalsy()
  })
})
