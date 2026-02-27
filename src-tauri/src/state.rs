use crate::config::ConfigStore;
use crate::db::Db;

#[derive(Clone)]
pub struct AppState {
    pub config: ConfigStore,
    pub db: Db,
}
