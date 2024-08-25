frappe.ui.form.on('Timesheet', {
    validate: function(frm) {
        frm.trigger('update_overtime_fields');
        frm.trigger('check_holidays');
    },

    update_overtime_fields: function(frm) {
        const max_rt_hours = 9.5;
        const day_deductions = {};

        frm.doc.time_logs.forEach(function(row) {
            if (row.hours) {
                const total_hours = parseFloat(row.hours);
                const day = new Date(row.from_time).toISOString().split('T')[0];

                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Employee',
                        name: frm.doc.employee
                    },
                    callback: function(r) {
                        if (r.message) {
                            const employee = r.message;
                            const applicable_ot = employee.custom_applicable_for_overtime && total_hours > max_rt_hours;

                            // Check if the deduction has already been applied for this day
                            if (!day_deductions[day]) {
                                day_deductions[day] = true;
                                row.custom_rt = total_hours > max_rt_hours ? max_rt_hours - 0.5 : total_hours - 0.5;
                            } else {
                                row.custom_rt = total_hours > max_rt_hours ? max_rt_hours : total_hours;
                            }

                            // Overtime calculation
                            row.custom_ot_1 = applicable_ot ? total_hours - max_rt_hours : 0;

                            frm.refresh_field('time_logs');
                            frm.trigger('update_totals'); // Update parent doctype totals
                        } else {
                            console.error("Employee not found.");
                        }
                    },
                    error: function() {
                        console.error("Error fetching employee data.");
                    }
                });
            } else {
                row.custom_ot_1 = 0;
                row.custom_rt = 0;
            }
        });

        frm.refresh_field('time_logs');
    },

    check_holidays: function(frm) {
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Employee',
                name: frm.doc.employee
            },
            callback: function(r) {
                if (r.message) {
                    const employee = r.message;
                    const holiday_list_name = employee.holiday_list;

                    if (holiday_list_name) {
                        frappe.call({
                            method: 'frappe.client.get',
                            args: {
                                doctype: 'Holiday List',
                                name: holiday_list_name
                            },
                            callback: function(r) {
                                if (r.message && r.message.holidays) {
                                    const holidays = r.message.holidays;

                                    frm.doc.time_logs.forEach(function(row) {
                                        if (row.from_time) {
                                            const from_time_date = new Date(row.from_time).toISOString().split('T')[0];
                                            let holiday_found = holidays.some(holiday => new Date(holiday.holiday_date).toISOString().split('T')[0] === from_time_date);

                                            if (holiday_found) {
                                                if (employee.custom_applicable_for_overtime) {
                                                    row.custom_ot_2 = row.hours;
                                                    row.custom_ot_1 = 0;
                                                    row.custom_rt = 0;
                                                } else {
                                                    row.custom_ot_2 = 0;
                                                    row.custom_rt = 0;
                                                }
                                                frm.refresh_field('time_logs');
                                                frm.trigger('update_totals'); // Update parent doctype totals
                                            }
                                        }
                                    });

                                    frm.refresh_field('time_logs');
                                } else {
                                    console.error("No holidays found for the specified Holiday List.");
                                }
                            },
                            error: function() {
                                console.error("Error fetching holiday list data.");
                            }
                        });
                    } else {
                        console.error("Holiday list name not found in the employee record.");
                    }
                }
            },
            error: function() {
                console.error("Error fetching employee data.");
            }
        });
    },

    update_totals: function(frm) {
        let custom_total_ot_1 = 0;
        let custom_total_ot_2 = 0;
        let custom_total_rt = 0;

        frm.doc.time_logs.forEach(function(row) {
            custom_total_ot_1 += row.custom_ot_1 || 0;
            custom_total_ot_2 += row.custom_ot_2 || 0;
            custom_total_rt += row.custom_rt || 0;
        });

        frm.set_value('custom_total_ot_1', custom_total_ot_1);
        frm.set_value('custom_total_ot_2', custom_total_ot_2);
        frm.set_value('custom_total_rt', custom_total_rt);
        frm.refresh_field('custom_total_ot_1');
        frm.refresh_field('custom_total_ot_2');
        frm.refresh_field('custom_total_rt');
    }
});

frappe.ui.form.on('Timesheet Detail', {
    hours: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.hours) {
            frm.trigger('update_overtime_fields');
            frm.trigger('check_holidays');
        }
    },

    from_time: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.from_time) {
            frm.trigger('check_holidays');
            
        }
    },
    time_logs_remove: function(frm) {
        frm.trigger('update_totals'); // Update totals when a row is removed
    }
});
