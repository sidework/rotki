import { Component, Vue } from 'vue-property-decorator';
import { mapGetters } from 'vuex';
import { Section, Status } from '@/store/const';
import { assert } from '@/utils/assertions';

@Component({
  computed: {
    ...mapGetters(['status'])
  }
})
export default class StatusMixin extends Vue {
  // The default value of the mixing. Implementers are required to set that.
  section: Section = Section.NONE;
  status!: (section: Section) => Status;

  get loading(): boolean {
    assert(this.section !== Section.NONE);
    const status = this.status(this.section);
    return !(
      status === Status.LOADED ||
      status === Status.PARTIALLY_LOADED ||
      status === Status.REFRESHING
    );
  }

  get refreshing(): boolean {
    assert(this.section !== Section.NONE);
    const status = this.status(this.section);
    return (
      status === Status.LOADING ||
      status === Status.REFRESHING ||
      status === Status.PARTIALLY_LOADED
    );
  }
}