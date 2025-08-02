
let settings = {
  agent: 'default',
  notifications_chat_id: null
};

function get_settings() {
  return settings;
}

function set_settings(newSettings) {
  settings = { ...settings, ...newSettings };
  return settings;
}

module.exports = {
  get_settings,
  set_settings
};
