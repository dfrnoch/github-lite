import { useSearchParams } from '@solidjs/router';
import { createSignal, onSettled } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { searchIcon } from '../../../../icons/octicons';

/**
 * "Find a member…" style filter input bound to a URL search param (debounced),
 * so filtered lists are shareable like on github.com. Resets `?page`.
 */
export default function SearchInput(props: { placeholder: string; param: string; class?: string }) {
  const [sp, setSp] = useSearchParams<Record<string, string>>();
  const [text, setText] = createSignal(() => sp[props.param] ?? '');
  let timer: ReturnType<typeof setTimeout> | undefined;
  onSettled(() => () => clearTimeout(timer));

  const commit = (value: string) => {
    clearTimeout(timer);
    setSp({ [props.param]: value.trim() || undefined, page: undefined }, { replace: true, scroll: false });
  };

  return (
    <div class={['relative', props.class]}>
      <Octicon icon={searchIcon} class="absolute left-2.5 top-2 text-fg-muted pointer-events-none" />
      <input
        type="search"
        class="form-control pl-8!"
        placeholder={props.placeholder}
        aria-label={props.placeholder}
        value={text()}
        onInput={(e) => {
          const v = e.currentTarget.value;
          setText(v);
          clearTimeout(timer);
          timer = setTimeout(() => commit(v), 300);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(e.currentTarget.value);
          }
        }}
      />
    </div>
  );
}
