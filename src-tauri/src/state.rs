use crate::config::ConfigStore;

#[derive(Clone)]
pub struct AppState {
    pub config: ConfigStore,
}
