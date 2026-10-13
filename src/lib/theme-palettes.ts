/**
 * Community color themes. Each palette is turned into a complete Primer token
 * sheet by scripts/custom-themes.ts (served at /themes/<id>.css): Primer's own
 * light or dark theme is recolored onto the palette — neutrals onto the
 * background→foreground ramp, accents onto the palette's accents, keeping
 * Primer's lightness so contrast stays sound — and the syntax colors come
 * straight from the palette.
 */

export interface PaletteColors {
  /** Page background, a darker/lighter "inset" variant, and raised surfaces. */
  bg: string;
  inset: string;
  surface: string;
  /** Text, muted text and borders. */
  fg: string;
  muted: string;
  border: string;
  red: string;
  orange: string;
  yellow: string;
  green: string;
  cyan: string;
  blue: string;
  purple: string;
  pink: string;
}

export interface PaletteSyntax {
  keyword: string;
  string: string;
  constant: string;
  entity: string;
  tag: string;
  variable: string;
  comment: string;
}

export interface Palette {
  id: string;
  name: string;
  family: 'light' | 'dark';
  colors: PaletteColors;
  syntax: PaletteSyntax;
}

export const PALETTES: Palette[] = [
  {
    id: 'dracula',
    name: 'Dracula',
    family: 'dark',
    colors: {
      bg: '#282a36', inset: '#21222c', surface: '#343746', fg: '#f8f8f2', muted: '#9ea8c7', border: '#44475a',
      red: '#ff5555', orange: '#ffb86c', yellow: '#f1fa8c', green: '#50fa7b', cyan: '#8be9fd', blue: '#bd93f9', purple: '#bd93f9', pink: '#ff79c6',
    },
    syntax: { keyword: '#ff79c6', string: '#f1fa8c', constant: '#bd93f9', entity: '#50fa7b', tag: '#ff79c6', variable: '#ffb86c', comment: '#6272a4' },
  },
  {
    id: 'nord',
    name: 'Nord',
    family: 'dark',
    colors: {
      bg: '#2e3440', inset: '#272c36', surface: '#3b4252', fg: '#eceff4', muted: '#a3adbf', border: '#434c5e',
      red: '#bf616a', orange: '#d08770', yellow: '#ebcb8b', green: '#a3be8c', cyan: '#88c0d0', blue: '#81a1c1', purple: '#b48ead', pink: '#b48ead',
    },
    syntax: { keyword: '#81a1c1', string: '#a3be8c', constant: '#b48ead', entity: '#88c0d0', tag: '#81a1c1', variable: '#d8dee9', comment: '#616e88' },
  },
  {
    id: 'catppuccin_mocha',
    name: 'Catppuccin Mocha',
    family: 'dark',
    colors: {
      bg: '#1e1e2e', inset: '#11111b', surface: '#313244', fg: '#cdd6f4', muted: '#a6adc8', border: '#45475a',
      red: '#f38ba8', orange: '#fab387', yellow: '#f9e2af', green: '#a6e3a1', cyan: '#94e2d5', blue: '#89b4fa', purple: '#cba6f7', pink: '#f5c2e7',
    },
    syntax: { keyword: '#cba6f7', string: '#a6e3a1', constant: '#fab387', entity: '#89b4fa', tag: '#89b4fa', variable: '#eba0ac', comment: '#9399b2' },
  },
  {
    id: 'catppuccin_macchiato',
    name: 'Catppuccin Macchiato',
    family: 'dark',
    colors: {
      bg: '#24273a', inset: '#181926', surface: '#363a4f', fg: '#cad3f5', muted: '#a5adcb', border: '#494d64',
      red: '#ed8796', orange: '#f5a97f', yellow: '#eed49f', green: '#a6da95', cyan: '#8bd5ca', blue: '#8aadf4', purple: '#c6a0f6', pink: '#f5bde6',
    },
    syntax: { keyword: '#c6a0f6', string: '#a6da95', constant: '#f5a97f', entity: '#8aadf4', tag: '#8aadf4', variable: '#ee99a0', comment: '#939ab7' },
  },
  {
    id: 'catppuccin_frappe',
    name: 'Catppuccin Frappé',
    family: 'dark',
    colors: {
      bg: '#303446', inset: '#232634', surface: '#414559', fg: '#c6d0f5', muted: '#a5adce', border: '#51576d',
      red: '#e78284', orange: '#ef9f76', yellow: '#e5c890', green: '#a6d189', cyan: '#81c8be', blue: '#8caaee', purple: '#ca9ee6', pink: '#f4b8e4',
    },
    syntax: { keyword: '#ca9ee6', string: '#a6d189', constant: '#ef9f76', entity: '#8caaee', tag: '#8caaee', variable: '#ea999c', comment: '#949cbb' },
  },
  {
    id: 'tokyo_night',
    name: 'Tokyo Night',
    family: 'dark',
    colors: {
      bg: '#1a1b26', inset: '#16161e', surface: '#1f2335', fg: '#c0caf5', muted: '#a9b1d6', border: '#292e42',
      red: '#f7768e', orange: '#ff9e64', yellow: '#e0af68', green: '#9ece6a', cyan: '#7dcfff', blue: '#7aa2f7', purple: '#bb9af7', pink: '#c099ff',
    },
    syntax: { keyword: '#bb9af7', string: '#9ece6a', constant: '#ff9e64', entity: '#7aa2f7', tag: '#f7768e', variable: '#e0af68', comment: '#565f89' },
  },
  {
    id: 'one_dark',
    name: 'One Dark',
    family: 'dark',
    colors: {
      bg: '#282c34', inset: '#21252b', surface: '#2c313a', fg: '#abb2bf', muted: '#8b929e', border: '#3e4451',
      red: '#e06c75', orange: '#d19a66', yellow: '#e5c07b', green: '#98c379', cyan: '#56b6c2', blue: '#61afef', purple: '#c678dd', pink: '#c678dd',
    },
    syntax: { keyword: '#c678dd', string: '#98c379', constant: '#d19a66', entity: '#61afef', tag: '#e06c75', variable: '#e06c75', comment: '#7f848e' },
  },
  {
    id: 'gruvbox_dark',
    name: 'Gruvbox Dark',
    family: 'dark',
    colors: {
      bg: '#282828', inset: '#1d2021', surface: '#32302f', fg: '#ebdbb2', muted: '#a89984', border: '#504945',
      red: '#fb4934', orange: '#fe8019', yellow: '#fabd2f', green: '#b8bb26', cyan: '#8ec07c', blue: '#83a598', purple: '#d3869b', pink: '#d3869b',
    },
    syntax: { keyword: '#fb4934', string: '#b8bb26', constant: '#d3869b', entity: '#fabd2f', tag: '#8ec07c', variable: '#83a598', comment: '#928374' },
  },
  {
    id: 'solarized_dark',
    name: 'Solarized Dark',
    family: 'dark',
    colors: {
      bg: '#002b36', inset: '#00212b', surface: '#073642', fg: '#93a1a1', muted: '#839496', border: '#0d4654',
      red: '#dc322f', orange: '#cb4b16', yellow: '#b58900', green: '#859900', cyan: '#2aa198', blue: '#268bd2', purple: '#6c71c4', pink: '#d33682',
    },
    syntax: { keyword: '#859900', string: '#2aa198', constant: '#d33682', entity: '#268bd2', tag: '#268bd2', variable: '#b58900', comment: '#586e75' },
  },
  {
    id: 'rose_pine',
    name: 'Rosé Pine',
    family: 'dark',
    colors: {
      bg: '#191724', inset: '#13111c', surface: '#1f1d2e', fg: '#e0def4', muted: '#908caa', border: '#26233a',
      red: '#eb6f92', orange: '#ebbcba', yellow: '#f6c177', green: '#9ccfd8', cyan: '#9ccfd8', blue: '#31748f', purple: '#c4a7e7', pink: '#ebbcba',
    },
    syntax: { keyword: '#31748f', string: '#f6c177', constant: '#ebbcba', entity: '#ebbcba', tag: '#9ccfd8', variable: '#c4a7e7', comment: '#6e6a86' },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    family: 'dark',
    colors: {
      bg: '#272822', inset: '#1e1f1c', surface: '#3e3d32', fg: '#f8f8f2', muted: '#a59f85', border: '#49483e',
      red: '#f92672', orange: '#fd971f', yellow: '#e6db74', green: '#a6e22e', cyan: '#66d9ef', blue: '#66d9ef', purple: '#ae81ff', pink: '#f92672',
    },
    syntax: { keyword: '#f92672', string: '#e6db74', constant: '#ae81ff', entity: '#a6e22e', tag: '#f92672', variable: '#fd971f', comment: '#88846f' },
  },
  {
    id: 'everforest_dark',
    name: 'Everforest Dark',
    family: 'dark',
    colors: {
      bg: '#2d353b', inset: '#232a2e', surface: '#343f44', fg: '#d3c6aa', muted: '#9da9a0', border: '#475258',
      red: '#e67e80', orange: '#e69875', yellow: '#dbbc7f', green: '#a7c080', cyan: '#83c092', blue: '#7fbbb3', purple: '#d699b6', pink: '#d699b6',
    },
    syntax: { keyword: '#e67e80', string: '#a7c080', constant: '#d699b6', entity: '#a7c080', tag: '#e69875', variable: '#7fbbb3', comment: '#859289' },
  },
  {
    id: 'kanagawa',
    name: 'Kanagawa',
    family: 'dark',
    colors: {
      bg: '#1f1f28', inset: '#16161d', surface: '#2a2a37', fg: '#dcd7ba', muted: '#a6a69c', border: '#363646',
      red: '#e46876', orange: '#ffa066', yellow: '#e6c384', green: '#98bb6c', cyan: '#7aa89f', blue: '#7e9cd8', purple: '#957fb8', pink: '#d27e99',
    },
    syntax: { keyword: '#957fb8', string: '#98bb6c', constant: '#ffa066', entity: '#7e9cd8', tag: '#e6c384', variable: '#e46876', comment: '#727169' },
  },
  {
    id: 'ayu_mirage',
    name: 'Ayu Mirage',
    family: 'dark',
    colors: {
      bg: '#1f2430', inset: '#1a1f29', surface: '#242936', fg: '#cccac2', muted: '#8a9199', border: '#33415e',
      red: '#f28779', orange: '#ffad66', yellow: '#ffd173', green: '#d5ff80', cyan: '#95e6cb', blue: '#73d0ff', purple: '#dfbfff', pink: '#f29e74',
    },
    syntax: { keyword: '#ffad66', string: '#d5ff80', constant: '#dfbfff', entity: '#ffd173', tag: '#5ccfe6', variable: '#f29e74', comment: '#6c7a8b' },
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    family: 'dark',
    colors: {
      bg: '#262335', inset: '#1e1a2b', surface: '#34294f', fg: '#ffffff', muted: '#b6b1d4', border: '#495495',
      red: '#fe4450', orange: '#f97e72', yellow: '#fede5d', green: '#72f1b8', cyan: '#36f9f6', blue: '#36f9f6', purple: '#ff7edb', pink: '#ff7edb',
    },
    syntax: { keyword: '#fede5d', string: '#ff8b39', constant: '#f97e72', entity: '#36f9f6', tag: '#72f1b8', variable: '#ff7edb', comment: '#848bbd' },
  },
  {
    // Modern true black (OLED): pure black canvas, hairline borders, vivid accents.
    id: 'midnight',
    name: 'Midnight',
    family: 'dark',
    colors: {
      bg: '#000000', inset: '#000000', surface: '#0a0a0a', fg: '#ededed', muted: '#a1a1a1', border: '#262626',
      red: '#ff6166', orange: '#ff990a', yellow: '#ffd60a', green: '#3dd68c', cyan: '#2fd3d3', blue: '#52a8ff', purple: '#bf7af0', pink: '#f75f8f',
    },
    syntax: { keyword: '#f75f8f', string: '#62c073', constant: '#52a8ff', entity: '#bf7af0', tag: '#3dd68c', variable: '#ff990a', comment: '#6e6e6e' },
  },
  {
    id: 'catppuccin_latte',
    name: 'Catppuccin Latte',
    family: 'light',
    colors: {
      bg: '#eff1f5', inset: '#e6e9ef', surface: '#e6e9ef', fg: '#4c4f69', muted: '#6c6f85', border: '#ccd0da',
      red: '#d20f39', orange: '#fe640b', yellow: '#df8e1d', green: '#40a02b', cyan: '#179299', blue: '#1e66f5', purple: '#8839ef', pink: '#ea76cb',
    },
    syntax: { keyword: '#8839ef', string: '#40a02b', constant: '#fe640b', entity: '#1e66f5', tag: '#1e66f5', variable: '#e64553', comment: '#7c7f93' },
  },
  {
    id: 'solarized_light',
    name: 'Solarized Light',
    family: 'light',
    colors: {
      bg: '#fdf6e3', inset: '#eee8d5', surface: '#f5efdc', fg: '#586e75', muted: '#73868c', border: '#e3dcc6',
      red: '#dc322f', orange: '#cb4b16', yellow: '#b58900', green: '#859900', cyan: '#2aa198', blue: '#268bd2', purple: '#6c71c4', pink: '#d33682',
    },
    syntax: { keyword: '#859900', string: '#2aa198', constant: '#d33682', entity: '#268bd2', tag: '#268bd2', variable: '#b58900', comment: '#93a1a1' },
  },
  {
    id: 'gruvbox_light',
    name: 'Gruvbox Light',
    family: 'light',
    colors: {
      bg: '#fbf1c7', inset: '#f2e5bc', surface: '#f2e5bc', fg: '#3c3836', muted: '#7c6f64', border: '#d5c4a1',
      red: '#9d0006', orange: '#af3a03', yellow: '#b57614', green: '#79740e', cyan: '#427b58', blue: '#076678', purple: '#8f3f71', pink: '#8f3f71',
    },
    syntax: { keyword: '#9d0006', string: '#79740e', constant: '#8f3f71', entity: '#b57614', tag: '#427b58', variable: '#076678', comment: '#928374' },
  },
  {
    id: 'rose_pine_dawn',
    name: 'Rosé Pine Dawn',
    family: 'light',
    colors: {
      bg: '#faf4ed', inset: '#f2e9e1', surface: '#fffaf3', fg: '#575279', muted: '#797593', border: '#dfdad9',
      red: '#b4637a', orange: '#d7827e', yellow: '#ea9d34', green: '#56949f', cyan: '#56949f', blue: '#286983', purple: '#907aa9', pink: '#d7827e',
    },
    syntax: { keyword: '#286983', string: '#ea9d34', constant: '#d7827e', entity: '#d7827e', tag: '#56949f', variable: '#907aa9', comment: '#9893a5' },
  },
  {
    id: 'tokyo_night_day',
    name: 'Tokyo Night Day',
    family: 'light',
    colors: {
      bg: '#e1e2e7', inset: '#d0d5e3', surface: '#e9e9ed', fg: '#3760bf', muted: '#6172b0', border: '#c4c8da',
      red: '#f52a65', orange: '#b15c00', yellow: '#8c6c3e', green: '#587539', cyan: '#007197', blue: '#2e7de9', purple: '#9854f1', pink: '#9854f1',
    },
    syntax: { keyword: '#9854f1', string: '#587539', constant: '#b15c00', entity: '#2e7de9', tag: '#f52a65', variable: '#3760bf', comment: '#848cb5' },
  },
];
