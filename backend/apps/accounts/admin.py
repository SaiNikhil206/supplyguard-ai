from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class SupplyGuardUserAdmin(UserAdmin):
    list_display = ("username", "email", "name", "role", "tenant", "is_active", "is_superuser")
    list_filter = ("tenant", "role", "is_active", "is_superuser")
    search_fields = ("username", "email", "name")
    fieldsets = (
        *UserAdmin.fieldsets,
        ("SupplyGuard", {"fields": ("tenant", "role", "name")}),
    )
    add_fieldsets = (
        *UserAdmin.add_fieldsets,
        ("SupplyGuard", {"fields": ("tenant", "role", "name", "email")}),
    )
