-- Row-Level Security policies for multi-tenant isolation
-- Every table with tenant_id is auto-filtered by the user's tenant assignments

-- Enable RLS on all tenant-scoped tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_mapping_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE express_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_template_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Tenants: users can see tenants they're assigned to
CREATE POLICY "tenants_select" ON tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid())
    OR owner_user_id = auth.uid()
  );

-- Tenant assignments: users can see their own assignments
CREATE POLICY "assignments_select" ON tenant_assignments
  FOR SELECT USING (user_id = auth.uid());

-- Generic tenant isolation policy (applied to all tenant-scoped data tables)
-- Chart of Accounts
CREATE POLICY "coa_tenant_isolation" ON chart_of_accounts
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid())
  );

-- Vendors
CREATE POLICY "vendors_tenant_isolation" ON vendors
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid())
  );

-- Customers
CREATE POLICY "customers_tenant_isolation" ON customers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid())
  );

-- Products
CREATE POLICY "products_tenant_isolation" ON products
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid())
  );

-- Departments
CREATE POLICY "departments_tenant_isolation" ON departments
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid())
  );

-- Documents
CREATE POLICY "documents_tenant_isolation" ON documents
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid())
  );

-- Journal Lines (via document's tenant)
CREATE POLICY "journal_lines_tenant_isolation" ON journal_lines
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid()
      )
    )
  );

-- GL Mapping Rules
CREATE POLICY "gl_rules_tenant_isolation" ON gl_mapping_rules
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid())
  );

-- Period Locks
CREATE POLICY "period_locks_tenant_isolation" ON period_locks
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid())
  );

-- Bank Statements
CREATE POLICY "bank_stmts_tenant_isolation" ON bank_statements
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid())
  );

-- Express Templates
CREATE POLICY "express_tpl_tenant_isolation" ON express_templates
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid())
  );

-- Export Template Selections
CREATE POLICY "export_sel_tenant_isolation" ON export_template_selections
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid())
  );

-- Audit Logs (read-only for assigned tenants)
CREATE POLICY "audit_logs_tenant_isolation" ON audit_logs
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid())
  );

-- Notifications (user's own only)
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- Notification Preferences (user's own only)
CREATE POLICY "notif_prefs_own" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());
