<template>
  <div class="batch-search h-100">
    <div class="container pt-4">
      <div class="container-fluid p-0">
        <b-btn @click="$refs['batch-search-form'].show()" variant="primary" class="float-right">
          <fa icon="plus" class="mr-1"></fa>
          {{ $t('batchSearch.heading') }}
        </b-btn>
        <form class="batch-search__search-bar " @submit.prevent="searchBatchsearches">
          <div class="d-flex align-items-left w-50">
            <div class="input-group">
              <input
                v-model="search"
                :placeholder="$t('batchSearch.placeholder')"
                class="batch-search__search-bar__input form-control">
              <div class="batch-search__search-bar__button input-group-append">
                <b-dropdown :text="$t('batchSearch.field.' + field)" variant="outline-light" class="batch-search__search-bar__field" right :class="{ 'search-bar__field--selected': field !== 'all' }">
                  <b-dropdown-item v-for="key in fieldOptions" :key="key" @click="field = key" class="batch-search__search-bar__field__items">
                    {{ $t('batchSearch.field.' + key) }}
                  </b-dropdown-item>
                </b-dropdown>
                <button type="submit" class="btn btn-dark">
                  {{ $t('search.buttonLabel') }}
                </button>
              </div>
            </div>
          </div>
        </form>
        <b-modal ref="batch-search-form" hide-footer :title="$t('batchSearch.heading')" size="md" body-class="p-0">
          <batch-search-form hide-title hide-border @submit="$refs['batch-search-form'].hide()"></batch-search-form>
        </b-modal>
      </div>
      <div class="batch-search__items">
        <v-wait for="load batchSearches">
          <div slot="waiting" class="card py-2">
            <content-placeholder class="py-2 px-3" v-for="index in 3" :key="index" />
          </div>
          <b-table
            hover
            no-sort-reset
            responsive
            show-empty
            striped
            class="card border-top-0"
            tbody-tr-class="batch-search__items__item"
            thead-tr-class="text-nowrap"
            :fields="fieldsIfAnyItem"
            :items="batchSearches"
            :sort-by="sortBy"
            :sort-desc="orderBy"
            @sort-changed="sortChanged">
            <template #empty v-if="!this.hasActiveFilter">
              <p class="batch-search__items__item__no-item text-center m-0" v-html="$t('batchSearch.empty', { howToLink })"></p>
            </template>
            <template #empty v-else>
              <p class="batch-search__items__item__no-item-filtered text-center m-0" v-html="$t('batchSearch.emptyWithFilter')"></p>
            </template>
            <template v-slot:cell(name)="{ item }">
              <router-link
                :to="generateTo(item)"
                class="batch-search__items__item__link">
                {{ item.name }}
              </router-link>
              <p class="m-0 text-muted small">
                {{ item.description }}
              </p>
            </template>
            <template v-slot:cell(queries)="{ item }">
              <span class="batch-search__items__item__queries">
                {{ $n(item.nbQueries) }}
              </span>
            </template>
            <template v-slot:cell(state)="{ item }">
              <batch-search-status :batch-search="item" />
            </template>
            <template v-slot:cell(date)="{ item }">
              <span :title="moment(item.date).locale($i18n.locale).format('LLL')">
                {{ moment(item.date).locale($i18n.locale).format('LL') }}
              </span>
            </template>
            <!-- eslint-disable-next-line vue/valid-v-slot -->
            <template v-slot:cell(user.id)="{ item }">
              <user-display :username="item.user.id" v-if="item.user" />
            </template>
            <template v-slot:cell(nbResults)="{ item }">
              <span class="batch-search__items__item__results">
                {{ $n(item.nbResults) }}
              </span>
            </template>
            <template v-slot:cell(published)="{ item }">
              {{ item.published ? $t('global.yes') : $t('global.no') }}
            </template>
            <template v-slot:cell(projects)="{ item }">
              <span class="batch-search__items__item__projects text-truncate" v-b-tooltip.hover :title="getProjectsNames(item)">
                {{ getProjectsNames(item) }}
              </span>
            </template>
          </b-table>
          <b-pagination-nav
            class="mt-2"
            :link-gen="linkGen"
            :number-of-pages="numberOfPages"
            use-router
            v-if="numberOfPages > 1"></b-pagination-nav>
        </v-wait>
      </div>
    </div>
  </div>
</template>

<script>
import { compact, find, get, random, some } from 'lodash'
import moment from 'moment'
import { mapState } from 'vuex'

import BatchSearchForm from '@/components/BatchSearchForm'
import BatchSearchStatus from '@/components/BatchSearchStatus'
import UserDisplay from '@/components/UserDisplay'
import polling from '@/mixins/polling'
import utils from '@/mixins/utils'
import settings from '@/utils/settings'

export default {
  name: 'BatchSearches',
  mixins: [polling, utils],
  components: {
    BatchSearchForm,
    BatchSearchStatus,
    UserDisplay
  },
  data () {
    return {
      field: 'all',
      order: settings.batchSearch.order,
      page: 1,
      perPage: settings.batchSearch.size,
      query: '',
      search: '',
      sort: settings.batchSearch.sort
    }
  },
  computed: {
    ...mapState('batchSearch', ['batchSearches', 'total']),
    howToLink () {
      const { href } = this.$router.resolve('/docs/all-batch-search-documents')
      return href
    },
    sortResults () {
      return settings.batchSearchResults.sort
    },
    orderResults () {
      return settings.batchSearchResults.order
    },
    projectNameField () {
      return this.isServer
        ? {
          key: 'projects',
          label: this.$t('batchSearch.projects'),
          sortable: true,
          name: 'projects'
        }
        : null
    },
    authorField () {
      return this.isServer
        ? {
          key: 'user.id',
          label: this.$t('batchSearch.author'),
          sortable: true,
          name: 'user_id'
        }
        : null
    },
    publishedField () {
      return this.isServer
        ? {
          key: 'published',
          label: this.$t('batchSearch.published'),
          sortable: true,
          name: 'published'
        }
        : null
    },
    fieldOptions () {
      const options = ['all', 'name', 'description']
      if (this.isServer) {
        options.push('user_id')
      }
      return options
    },
    fieldsIfAnyItem () {
      if (this.batchSearches.length) {
        return this.fields
      }
      return []
    },
    fields () {
      return compact([
        {
          key: 'state',
          label: this.$t('batchSearch.state'),
          sortable: true,
          name: 'state'
        },
        this.projectNameField,
        {
          key: 'name',
          label: this.$t('batchSearch.name'),
          sortable: true,
          name: 'name'
        },
        this.authorField,
        {
          key: 'queries',
          label: this.$t('batchSearch.queries'),
          sortable: false
        },
        {
          key: 'date',
          label: this.$t('batchSearch.date'),
          sortable: true,
          name: 'batch_date'
        },
        {
          key: 'nbResults',
          label: this.$t('batchSearch.nbResults'),
          sortable: true,
          name: 'batch_results'
        },
        this.publishedField
      ])
    },
    sortBy () {
      return find(this.fields, item => item.name === this.sort).key
    },
    orderBy () {
      return this.order === 'desc'
    },
    numberOfPages () {
      return Math.ceil(this.total / this.perPage)
    },
    hasPendingBatchSearches () {
      const pendingStates = ['RUNNING', 'QUEUED']
      return some(this.batchSearches, ({ state }) => pendingStates.includes(state))
    },
    hasActiveFilter () {
      return this.query !== ''
    }
  },
  watch: {
    page () {
      this.fetchWithLoader()
    },
    sort () {
      this.fetchWithLoader()
    },
    order () {
      this.fetchWithLoader()
    },
    query () {
      this.fetchWithLoader()
    }
  },
  beforeRouteEnter (to, from, next) {
    next(vm => {
      vm.$set(vm, 'page', parseInt(get(to, 'query.page', vm.page)))
      vm.$set(vm, 'sort', get(to, 'query.sort', vm.sort))
      vm.$set(vm, 'order', get(to, 'query.order', vm.order))
      vm.$set(vm, 'query', get(to, 'query.query', vm.query))
      vm.$set(vm, 'field', get(to, 'query.field', vm.field))
      vm.$set(vm, 'search', get(to, 'query.query', vm.search))
    })
  },
  beforeRouteUpdate (to, from, next) {
    this.$set(this, 'page', parseInt(get(to, 'query.page', this.page)))
    this.$set(this, 'sort', get(to, 'query.sort', this.sort))
    this.$set(this, 'order', get(to, 'query.order', this.order))
    this.$set(this, 'query', get(to, 'query.query', this.query))
    this.$set(this, 'field', get(to, 'query.field', this.field))
    this.$set(this, 'search', get(to, 'query.query', this.search))
    next()
  },
  async mounted () {
    this.fetchWithLoader()
  },
  methods: {
    generateTo (item) {
      const baseTo = { name: 'batch-search.results', params: { index: this.getProjectsNames(item).replace(/\s/g, ''), uuid: item.uuid }, query: { page: 1, sort: this.sortResults, order: this.orderResults } }
      const searchQueryExists = this.query
      return {
        ...baseTo,
        ...(searchQueryExists && { query: { query: this.query } })
      }
    },
    generateLinkToBatchSearch ({
      page = this.page,
      sort = this.sort,
      order = this.order,
      query = this.query,
      field = this.field
    }) {
      return {
        name: 'batch-search',
        query: { page, sort, order, query, field }
      }
    },
    sortChanged (ctx) {
      const sort = find(this.fields, item => item.key === ctx.sortBy).name
      const order = ctx.sortDesc ? 'desc' : 'asc'
      const params = { page: this.page, sort, order }
      return this.$router.push(this.generateLinkToBatchSearch(params))
    },
    async fetch () {
      const from = (this.page - 1) * this.perPage
      const size = this.perPage
      const params = { from, size, sort: this.sort, order: this.order, query: this.query, field: this.field }
      await this.$store.dispatch('batchSearch/getBatchSearches', params)
    },
    async fetchWithLoader () {
      this.$wait.start('load batchSearches')
      this.$Progress.start()
      await this.fetchAndRegisterPoll()
      this.$Progress.finish()
      this.$wait.end('load batchSearches')
    },
    async fetchForPoll () {
      await this.fetch()
      // Continue to poll data if they are pending batch searches and we are on page 1
      return this.page === 1 && this.hasPendingBatchSearches
    },
    async fetchAndRegisterPoll () {
      await this.fetch()
      const fn = this.fetchForPoll
      const timeout = () => random(1000, 4000)
      this.registerPollOnce({ fn, timeout })
    },
    linkGen (page) {
      return this.generateLinkToBatchSearch({ page })
    },
    searchBatchsearches () {
      this.$set(this, 'query', this.search)
      const params = { page: 1, query: this.query }
      return this.$router.push(this.generateLinkToBatchSearch(params))
    },
    getProjectsNames (item) {
      if (item.projects === undefined) {
        return ''
      } else {
        return item.projects.map(project => project.name).join(', ')
      }
    },
    moment
  }
}
</script>

<style lang="scss" scoped>
  .batch-search {
    &__search-bar {
      &__input {
        border-radius: 1.5em 0 0 1.5rem;
      }

      &__button .btn {
        border-radius: 0 1.5em 1.5rem 0;
      }

      &__field {
        background: $input-bg;
        border-left: dashed 1px  $input-border-color;
        font-size: inherit;

        &--selected:after {
          bottom: 1px;
          border: 2px solid $tertiary;
          content: "";
          left: 0;
          position: absolute;
          right: 1px;
          top: 1px;
        }

        &:deep(.btn) {
          border: 1px solid $input-border-color;
          border-left: 0;
          box-shadow: $input-box-shadow;
          color: $text-muted;

          .input-group-lg & {
            font-size: 1.25rem;
          }
        }
      }
    }

    &__items {
      border-radius: $card-border-radius 0 0 0;
      margin-top: $spacer;
      overflow: hidden;
      position: static;

      &:deep(.table-responsive) {
        margin: 0;
      }

      &:deep(table) {
        margin: 0;

        thead th {
          white-space: nowrap;
        }
      }

      &__item {

        &__projects {
          display: block;
          max-width: 10vw;
        }
      }
    }
  }
</style>
